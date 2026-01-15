import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

// Configuração Next.js - Força execução dinâmica
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Limite padrão da Vercel (Hobby)

// --- CONFIGURAÇÃO DE SEGURANÇA E PERFORMANCE ---
const BATCH_SIZE_FULL = 3;    // E-mails RECENTES: Baixa poucos por vez (Pesado)
const BATCH_SIZE_LIGHT = 50;  // E-mails ANTIGOS: Baixa muitos por vez (Só cabeçalho, Leve)
const MAX_BODY_SIZE = 100000; // 100KB máx de texto (Corta excessos)
const DAYS_FOR_FULL_SYNC = 7; // E-mails com menos de 7 dias baixam completos

async function syncFolder(connection, dbConfigId, folderName, supabase) {
    try {
        await connection.openBox(folderName);
        
        // 1. Busca estrutura leve (UIDs, Flags e DATAS)
        // Adicionamos 'HEADER.FIELDS (DATE)' para saber a data antes de baixar o corpo
        const searchCriteria = ['ALL'];
        const fetchOptions = { bodies: ['HEADER.FIELDS (DATE)'], struct: true, markSeen: false };
        const imapMessages = await connection.search(searchCriteria, fetchOptions);
        
        const imapMap = new Map();
        
        // Mapeia UID -> Flags e Data
        imapMessages.forEach(msg => {
            // Tenta pegar a data dos atributos ou do header
            let dateStr = msg.attributes.date;
            if (!dateStr && msg.parts && msg.parts[0] && msg.parts[0].body && msg.parts[0].body.date) {
                dateStr = msg.parts[0].body.date[0];
            }
            
            imapMap.set(msg.attributes.uid, { 
                flags: msg.attributes.flags || [],
                date: new Date(dateStr || new Date())
            });
        });

        // 2. Busca o que já temos no Cache do Supabase
        const { data: dbMessages } = await supabase
            .from('email_messages_cache')
            .select('uid, is_read')
            .eq('account_id', dbConfigId)
            .eq('folder_path', folderName);

        const dbMap = new Map();
        dbMessages?.forEach(msg => dbMap.set(msg.uid, msg));

        // --- A. LIMPEZA (Deleta removidos do servidor) ---
        const uidsToDelete = [];
        dbMap.forEach((val, uid) => { if (!imapMap.has(uid)) uidsToDelete.push(uid); });

        if (uidsToDelete.length > 0) {
            const batchDel = uidsToDelete.slice(0, 50); 
            await supabase.from('email_messages_cache')
                .delete()
                .eq('account_id', dbConfigId)
                .eq('folder_path', folderName)
                .in('uid', batchDel);
        }

        // --- B. ATUALIZA STATUS (Lido/Não Lido) ---
        const uidsToMarkRead = [];
        imapMap.forEach((val, uid) => {
            if (dbMap.has(uid)) {
                const dbIsRead = dbMap.get(uid).is_read;
                const imapIsRead = val.flags.includes('\\Seen');
                if (imapIsRead && !dbIsRead) uidsToMarkRead.push(uid);
            }
        });

        if (uidsToMarkRead.length > 0) {
            const batchUpd = uidsToMarkRead.slice(0, 50);
            await supabase.from('email_messages_cache')
                .update({ is_read: true })
                .eq('account_id', dbConfigId)
                .eq('folder_path', folderName)
                .in('uid', batchUpd);
        }

        // --- C. BAIXAR NOVOS (Lógica Híbrida 🧠) ---
        const missingUids = Array.from(imapMap.keys())
            .filter(uid => !dbMap.has(uid))
            .sort((a, b) => b - a); // Do mais novo para o mais antigo

        if (missingUids.length === 0) {
            return { new: 0, pending: 0 };
        }

        // DECISÃO DO MODO DE OPERAÇÃO:
        // Olhamos o e-mail mais recente da fila para decidir como baixar
        const nextUid = missingUids[0];
        const emailDate = imapMap.get(nextUid)?.date || new Date();
        
        // Data de corte (Hoje - 7 dias)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - DAYS_FOR_FULL_SYNC);

        const isRecent = emailDate > cutoffDate;

        // Se for RECENTE: Baixa poucos (3) mas com TUDO.
        // Se for ANTIGO: Baixa muitos (50) mas SÓ CABEÇALHO.
        const currentBatchSize = isRecent ? BATCH_SIZE_FULL : BATCH_SIZE_LIGHT;
        const uidsToDownload = missingUids.slice(0, currentBatchSize);
        
        // Define o que vamos pedir pro servidor de e-mail
        // '' = Corpo Inteiro | 'HEADER' = Só cabeçalho
        const fetchBodyParts = isRecent ? [''] : ['HEADER'];

        console.log(`📥 [${folderName}] Baixando ${uidsToDownload.length} itens. Modo: ${isRecent ? 'COMPLETO (Recente)' : 'LEVE (Antigo)'}`);

        const fullMessages = await connection.search([['UID', uidsToDownload]], {
            bodies: fetchBodyParts, 
            markSeen: false
        });

        const recordsToInsert = [];

        for (const msg of fullMessages) {
            try {
                // Tenta pegar a parte do corpo (full) ou cabeçalho (light)
                const partToParse = msg.parts.find(p => p.which === '') || msg.parts.find(p => p.which === 'HEADER') || msg.parts[0];
                const parsed = await simpleParser(partToParse.body);

                let textBody = null; // Começa nulo (padrão para antigos)
                let htmlBody = null; 
                let attachments = [];

                // SÓ processa corpo pesado se for RECENTE
                if (isRecent) {
                    textBody = parsed.textAsHtml || parsed.text || '';
                    if (textBody.length > MAX_BODY_SIZE) {
                        textBody = textBody.substring(0, MAX_BODY_SIZE) + '... [Conteúdo Cortado]';
                    }
                    
                    htmlBody = parsed.html || '';
                    if (htmlBody.length > MAX_BODY_SIZE) {
                         htmlBody = htmlBody.substring(0, MAX_BODY_SIZE) + '... [Conteúdo Cortado]';
                    }

                    if (parsed.attachments) {
                        attachments = parsed.attachments.map(att => ({
                            filename: att.filename,
                            contentType: att.contentType,
                            size: att.size
                        }));
                    }
                }

                // Garante dados vitais
                const subject = parsed.subject || '(Sem Assunto)';
                const date = parsed.date || imapMap.get(msg.attributes.uid)?.date || new Date();

                const emailData = {
                    id: msg.attributes.uid,
                    subject: subject,
                    from: parsed.from?.text,
                    to: parsed.to?.text,
                    cc: parsed.cc?.text,
                    date: date,
                    html: htmlBody, // Será null nos antigos
                    text: textBody, // Será null nos antigos
                    attachments: attachments
                };

                recordsToInsert.push({
                    account_id: dbConfigId,
                    uid: msg.attributes.uid,
                    folder_path: folderName,
                    subject: subject.substring(0, 255),
                    from_text: parsed.from?.text ? parsed.from.text.substring(0, 255) : '',
                    to_text: parsed.to?.text ? parsed.to.text.substring(0, 500) : '',
                    cc_text: parsed.cc?.text ? parsed.cc.text.substring(0, 500) : '',
                    date: date,
                    is_read: msg.attributes.flags.includes('\\Seen'),
                    conteudo_cache: emailData,
                    updated_at: new Date().toISOString()
                });
            } catch (parseErr) {
                console.error(`Erro parse ${msg.attributes.uid}:`, parseErr);
            }
        }

        if (recordsToInsert.length > 0) {
            const { error } = await supabase.from('email_messages_cache').upsert(recordsToInsert, { 
                onConflict: 'account_id, folder_path, uid' 
            });
            
            if (error) {
                // Erro aqui geralmente é timeout ou tamanho. Como otimizamos os antigos, deve parar.
                console.error("Erro CRÍTICO no insert cache:", error);
                throw error; 
            }
        }
        
        return { 
            new: uidsToDownload.length, 
            pending: Math.max(0, missingUids.length - currentBatchSize) 
        };

    } catch (err) {
        console.error(`Erro sync pasta ${folderName}:`, err);
        return { error: err.message };
    }
}

export async function POST(request) {
    const supabase = await createClient();
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const { data: accounts } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
        if (!accounts?.length) return NextResponse.json({ message: 'No accounts' });

        const stats = { totalNew: 0, totalPending: 0 };

        for (const config of accounts) {
            let connection = null;
            try {
                connection = await imapSimple.connect({
                    imap: {
                        user: config.imap_user || config.email,
                        password: config.senha_app,
                        host: config.imap_host,
                        port: config.imap_port || 993,
                        tls: true,
                        authTimeout: 15000,
                        tlsOptions: { rejectUnauthorized: false }
                    },
                });

                const criticalFolders = ['INBOX']; 
                
                for (const folder of criticalFolders) {
                    const res = await syncFolder(connection, config.id, folder, supabase);
                    if (res && res.new) stats.totalNew += res.new;
                    if (res && res.pending) stats.totalPending += res.pending;
                }

            } catch (err) {
                console.error(`Erro conta ${config.email}:`, err);
            } finally {
                if (connection) connection.end();
            }
        }

        return NextResponse.json({ success: true, ...stats });
    } catch (error) {
        console.error("Erro Geral Sync:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req) { return POST(req); }