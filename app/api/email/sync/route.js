import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

// Configuração Next.js
export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

// --- CONFIGURAÇÃO ---
const SYNC_DAYS = 5; // Olha apenas os últimos 5 dias (janela de e-mails novos)
const MAX_BODY_SIZE = 100000; // 100KB limite texto

async function syncFolder(connection, dbConfigId, folderName, supabase) {
    try {
        await connection.openBox(folderName);
        
        // 1. DATA DE CORTE: Define o que é "Novo"
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - SYNC_DAYS);
        
        // Formata a data para o padrão IMAP (ex: "May 20, 2024")
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = dateLimit.getDate();
        const month = months[dateLimit.getMonth()];
        const year = dateLimit.getFullYear();
        const imapDate = `${month} ${day}, ${year}`;

        console.log(`🔎 [${folderName}] Buscando e-mails desde: ${imapDate}`);

        // 2. BUSCA APENAS RECENTES (O Segredo da Performance 🚀)
        // Usamos 'SINCE' para o servidor filtrar para nós. Não trazemos lixo antigo.
        const searchCriteria = [['SINCE', imapDate]];
        const fetchOptions = { bodies: ['HEADER.FIELDS (MESSAGE-ID)'], struct: true, markSeen: false };
        
        // Primeiro pegamos a lista leve dos recentes para comparar
        const recentMessages = await connection.search(searchCriteria, fetchOptions);
        
        if (recentMessages.length === 0) {
            console.log(`✅ [${folderName}] Nenhum e-mail recente encontrado.`);
            return { new: 0, pending: 0 };
        }

        const imapMap = new Map();
        recentMessages.forEach(msg => imapMap.set(msg.attributes.uid, msg));

        // 3. Verifica o que JÁ TEMOS no Banco (nessa janela de tempo)
        // Precisamos saber quais desses recentes nós JÁ baixamos para não baixar de novo
        const { data: existingDbMessages } = await supabase
            .from('email_messages_cache')
            .select('uid')
            .eq('account_id', dbConfigId)
            .eq('folder_path', folderName)
            .gte('date', dateLimit.toISOString()); // Otimização: Só compara com recentes do banco

        const existingUids = new Set(existingDbMessages?.map(m => m.uid));

        // 4. FILTRAR: Quem falta baixar?
        const uidsToDownload = [];
        imapMap.forEach((msg, uid) => {
            if (!existingUids.has(uid)) {
                uidsToDownload.push(uid);
            }
        });

        // Atualiza status de LIDO/NÃO LIDO dos que já existem
        // (Isso é rápido e mantém a visualização correta)
        const uidsToUpdateStatus = [];
        recentMessages.forEach(msg => {
            if (existingUids.has(msg.attributes.uid)) {
                 // Lógica simples: Se no IMAP tá lido, garante que no banco tá lido
                 if (msg.attributes.flags && msg.attributes.flags.includes('\\Seen')) {
                     uidsToUpdateStatus.push(msg.attributes.uid);
                 }
            }
        });

        if (uidsToUpdateStatus.length > 0) {
             // Atualiza status em lote (max 50 por vez pra ser seguro)
             const batch = uidsToUpdateStatus.slice(0, 50);
             await supabase.from('email_messages_cache')
                .update({ is_read: true })
                .eq('account_id', dbConfigId)
                .in('uid', batch);
        }

        // 5. BAIXAR CONTEÚDO (Apenas dos Novos que faltam)
        if (uidsToDownload.length > 0) {
            console.log(`📥 [${folderName}] Baixando conteúdo de ${uidsToDownload.length} novos e-mails...`);
            
            // Baixa em lotes pequenos para garantir
            const downloadBatch = uidsToDownload.slice(0, 10); // 10 por vez é seguro e rápido para recentes

            const fullMessages = await connection.search([['UID', downloadBatch]], {
                bodies: [''], 
                markSeen: false
            });

            const recordsToInsert = [];

            for (const msg of fullMessages) {
                try {
                    const allParts = msg.parts.find(part => part.which === '');
                    const parsed = await simpleParser(allParts.body);

                    let textBody = parsed.textAsHtml || parsed.text || '';
                    if (textBody.length > MAX_BODY_SIZE) {
                        textBody = textBody.substring(0, MAX_BODY_SIZE) + '... [Cortado]';
                    }
                    
                    let htmlBody = parsed.html || '';
                    if (htmlBody.length > MAX_BODY_SIZE) {
                         htmlBody = htmlBody.substring(0, MAX_BODY_SIZE) + '... [Cortado]';
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
                const { error } = await supabase.from('email_messages_cache').upsert(recordsToInsert, { 
                    onConflict: 'account_id, folder_path, uid' 
                });
                
                if (error) {
                    console.error("Erro insert cache:", error);
                    throw error;
                }
            }
            
            return { new: recordsToInsert.length, pending: Math.max(0, uidsToDownload.length - 10) };
        }
        
        return { new: 0, pending: 0 };

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

                const folders = ['INBOX']; 
                
                for (const folder of folders) {
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