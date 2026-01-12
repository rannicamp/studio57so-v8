import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

// Configuração Next.js - Força execução dinâmica
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Limite padrão da Vercel (Hobby)

// --- CONFIGURAÇÃO DE SEGURANÇA ---
const BATCH_SIZE = 3; // BAIXÍSSIMO para garantir que salve sem timeout
const MAX_BODY_SIZE = 100000; // 100KB máx de texto por e-mail (corta o excesso)

async function syncFolder(connection, dbConfigId, folderName, supabase) {
    try {
        await connection.openBox(folderName);
        
        // 1. Busca estrutura leve (UIDs e Flags)
        const searchCriteria = ['ALL'];
        const fetchOptions = { bodies: [], struct: true, markSeen: false };
        const imapMessages = await connection.search(searchCriteria, fetchOptions);
        
        const imapMap = new Map();
        imapMessages.forEach(msg => imapMap.set(msg.attributes.uid, { flags: msg.attributes.flags || [] }));

        // 2. Busca o que já temos no Cache
        const { data: dbMessages } = await supabase
            .from('email_messages_cache')
            .select('uid, is_read')
            .eq('account_id', dbConfigId)
            .eq('folder_path', folderName);

        const dbMap = new Map();
        dbMessages?.forEach(msg => dbMap.set(msg.uid, msg));

        // --- A. LIMPEZA (Deleta removidos) ---
        const uidsToDelete = [];
        dbMap.forEach((val, uid) => { if (!imapMap.has(uid)) uidsToDelete.push(uid); });

        if (uidsToDelete.length > 0) {
            const batchDel = uidsToDelete.slice(0, 20); // Deleta 20 por vez
            await supabase.from('email_messages_cache')
                .delete()
                .eq('account_id', dbConfigId)
                .eq('folder_path', folderName)
                .in('uid', batchDel);
        }

        // --- B. ATUALIZA STATUS ---
        const uidsToMarkRead = [];
        imapMap.forEach((val, uid) => {
            if (dbMap.has(uid)) {
                const dbIsRead = dbMap.get(uid).is_read;
                const imapIsRead = val.flags.includes('\\Seen');
                if (imapIsRead && !dbIsRead) uidsToMarkRead.push(uid);
            }
        });

        if (uidsToMarkRead.length > 0) {
            const batchUpd = uidsToMarkRead.slice(0, 20);
            await supabase.from('email_messages_cache')
                .update({ is_read: true })
                .eq('account_id', dbConfigId)
                .eq('folder_path', folderName)
                .in('uid', batchUpd);
        }

        // --- C. BAIXAR NOVOS (O PULO DO GATO 🐈) ---
        const missingUids = Array.from(imapMap.keys())
            .filter(uid => !dbMap.has(uid))
            .sort((a, b) => b - a); // Do mais novo para o mais antigo

        // SEGURANÇA MÁXIMA: Pega só o lotezinho de 3 e-mails
        const uidsToDownload = missingUids.slice(0, BATCH_SIZE); 

        if (uidsToDownload.length > 0) {
            console.log(`📥 [${folderName}] Baixando ${uidsToDownload.length} novos (Lote Seguro)...`);
            
            const fullMessages = await connection.search([['UID', uidsToDownload]], {
                bodies: [''], 
                markSeen: false
            });

            const recordsToInsert = [];

            for (const msg of fullMessages) {
                try {
                    const allParts = msg.parts.find(part => part.which === '');
                    const parsed = await simpleParser(allParts.body);

                    // TRUNCAGEM DE TEXTO: Corta se for gigante para não dar Timeout no Supabase
                    let textBody = parsed.textAsHtml || parsed.text || '';
                    if (textBody.length > MAX_BODY_SIZE) {
                        textBody = textBody.substring(0, MAX_BODY_SIZE) + '... [Conteúdo Cortado por Tamanho]';
                    }
                    
                    let htmlBody = parsed.html || false;
                    if (htmlBody && htmlBody.length > MAX_BODY_SIZE) {
                         htmlBody = htmlBody.substring(0, MAX_BODY_SIZE) + '... [Conteúdo Cortado por Tamanho]';
                    }

                    const emailData = {
                        id: msg.attributes.uid,
                        subject: parsed.subject,
                        from: parsed.from?.text,
                        to: parsed.to?.text,
                        cc: parsed.cc?.text,
                        date: parsed.date,
                        html: htmlBody,
                        text: textBody,
                        attachments: parsed.attachments.map(att => ({
                            filename: att.filename,
                            contentType: att.contentType,
                            size: att.size
                        }))
                    };

                    recordsToInsert.push({
                        account_id: dbConfigId,
                        uid: msg.attributes.uid,
                        folder_path: folderName,
                        subject: parsed.subject ? parsed.subject.substring(0, 255) : '(Sem Assunto)',
                        from_text: parsed.from?.text ? parsed.from.text.substring(0, 255) : '',
                        to_text: parsed.to?.text ? parsed.to.text.substring(0, 500) : '',
                        cc_text: parsed.cc?.text ? parsed.cc.text.substring(0, 500) : '',
                        date: parsed.date || new Date(),
                        is_read: msg.attributes.flags.includes('\\Seen'),
                        conteudo_cache: emailData,
                        updated_at: new Date().toISOString()
                    });
                } catch (parseErr) {
                    console.error(`Erro parse ${msg.attributes.uid}:`, parseErr);
                }
            }

            if (recordsToInsert.length > 0) {
                // Tenta salvar no Supabase
                const { error } = await supabase.from('email_messages_cache').upsert(recordsToInsert, { 
                    onConflict: 'account_id, folder_path, uid' 
                });
                
                if (error) {
                    // Se der erro aqui, é o Supabase reclamando do tamanho
                    console.error("Erro CRÍTICO no insert cache:", error);
                    throw error; 
                }
            }
        }
        
        return { new: uidsToDownload.length, pending: Math.max(0, missingUids.length - BATCH_SIZE) };

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

                // Foca APENAS na Caixa de Entrada por enquanto para destravar
                // Depois que baixar tudo, ele vai pras outras
                const criticalFolders = ['INBOX']; 
                
                for (const folder of criticalFolders) {
                    const res = await syncFolder(connection, config.id, folder, supabase);
                    if (res.new) stats.totalNew += res.new;
                    if (res.pending) stats.totalPending += res.pending;
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