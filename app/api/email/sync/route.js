import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

// Configuração Next.js - Dinâmico
export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

// --- CONFIGURAÇÃO ---
const MAX_BODY_SIZE = 100000; // 100KB limite para texto

async function syncFolder(connection, dbConfigId, folderName, supabase) {
    try {
        await connection.openBox(folderName);
        
        // 1. DEFINIR DATA: APENAS HOJE 📅
        // Pega a data atual do servidor
        const today = new Date();
        
        // Formatação manual para padrão IMAP (ex: "Jan 15, 2026")
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const imapDateStr = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

        console.log(`🔎 [${folderName}] Buscando APENAS e-mails de HOJE (${imapDateStr})...`);

        // 2. BUSCA NO SERVIDOR
        // SINCE + Data de Hoje = Apenas e-mails a partir da 00:00 de hoje
        const searchCriteria = [['SINCE', imapDateStr]];
        const fetchOptions = { bodies: ['HEADER.FIELDS (MESSAGE-ID)'], struct: true, markSeen: false };
        
        const recentMessages = await connection.search(searchCriteria, fetchOptions);
        
        if (recentMessages.length === 0) {
            console.log(`✅ [${folderName}] Nenhum e-mail chegou hoje.`);
            return { new: 0, pending: 0 };
        }

        const imapMap = new Map();
        recentMessages.forEach(msg => imapMap.set(msg.attributes.uid, msg));

        // 3. O QUE JÁ TEMOS NO BANCO?
        // Verifica apenas os UIDs encontrados hoje
        const recentUids = Array.from(imapMap.keys());
        
        const { data: existingDbMessages } = await supabase
            .from('email_messages_cache')
            .select('uid, is_read')
            .eq('account_id', dbConfigId)
            .eq('folder_path', folderName)
            .in('uid', recentUids);

        const dbMap = new Map();
        existingDbMessages?.forEach(msg => dbMap.set(msg.uid, msg));

        // 4. ATUALIZA STATUS (Se leu no celular hoje, marca lido no sistema)
        const uidsToUpdateRead = [];
        recentMessages.forEach(msg => {
            if (dbMap.has(msg.attributes.uid)) {
                const isSeenImap = msg.attributes.flags && msg.attributes.flags.includes('\\Seen');
                const isReadDb = dbMap.get(msg.attributes.uid).is_read;
                
                if (isSeenImap && !isReadDb) {
                    uidsToUpdateRead.push(msg.attributes.uid);
                }
            }
        });

        if (uidsToUpdateRead.length > 0) {
            await supabase.from('email_messages_cache')
                .update({ is_read: true })
                .eq('account_id', dbConfigId)
                .in('uid', uidsToUpdateRead);
        }

        // 5. BAIXAR CONTEÚDO (Apenas o que falta de hoje)
        const uidsToDownload = recentUids.filter(uid => !dbMap.has(uid));

        if (uidsToDownload.length > 0) {
            console.log(`📥 [${folderName}] Baixando ${uidsToDownload.length} e-mails de hoje...`);
            
            // Como são só os de hoje, baixamos tudo de uma vez (corpo completo)
            const fullMessages = await connection.search([['UID', uidsToDownload]], {
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
            
            return { new: recordsToInsert.length, pending: 0 };
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

                // Foca apenas na entrada
                const res = await syncFolder(connection, config.id, 'INBOX', supabase);
                if (res && res.new) stats.totalNew += res.new;

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