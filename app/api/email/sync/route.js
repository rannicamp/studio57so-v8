import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import webPush from 'web-push';

// --- CONFIGURAÇÃO WEB PUSH ---
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
    try {
        webPush.setVapidDetails(
            'mailto:suporte@studio57.arq.br',
            publicKey,
            privateKey
        );
    } catch (err) {
        console.error("❌ [Email Sync] Erro config VAPID:", err);
    }
}

// --- FUNÇÃO DE DISPARO ---
async function dispatchEmailNotification(supabase, userId, title, message, organizacaoId, specificEmailId = null) {
    try {
        // Link inteligente: Se tiver ID específico, aponta pra ele. Se não, vai pra Inbox geral.
        const targetUrl = specificEmailId 
            ? `/caixa-de-entrada?email_id=${specificEmailId}` 
            : '/caixa-de-entrada';

        // 1. Salva no Sininho
        await supabase.from('notificacoes').insert({
            user_id: userId,
            titulo: title,
            mensagem: message,
            link: targetUrl,
            lida: false,
            tipo: 'sistema',
            organizacao_id: organizacaoId,
            created_at: new Date().toISOString()
        });

        // 2. Dispara Push Mobile
        const { data: subscriptions } = await supabase
            .from('notification_subscriptions')
            .select('*')
            .eq('user_id', userId);

        if (subscriptions?.length > 0) {
            const payload = JSON.stringify({
                title: title,
                body: message,
                url: targetUrl, // O Service Worker vai ler isso aqui
                icon: '/icons/icon-192x192.png',
                tag: 'email-update'
            });

            const promises = subscriptions.map(sub => 
                webPush.sendNotification(sub.subscription_data, payload).catch(async err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await supabase.from('notification_subscriptions').delete().eq('id', sub.id);
                    }
                })
            );
            await Promise.allSettled(promises);
        }
    } catch (e) {
        console.error("❌ [Email Push] Falha:", e);
    }
}

async function runEmailSync() {
    const supabase = await createClient();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Sem usuário na sessão (Cron requer Service Role)' };

    const { data: accounts } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
    if (!accounts?.length) return { message: 'Sem contas configuradas' };

    let totalNew = 0;
    let singleNewMessageData = null; // Vamos guardar os dados do "único" novo e-mail aqui

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
                    authTimeout: 10000,
                    tlsOptions: { rejectUnauthorized: false }
                }
            });

            const boxes = await connection.getBoxes();
            
            // Função auxiliar para achar a Inbox
            const findInbox = (list) => {
                for (const key in list) {
                    if (key.toUpperCase() === 'INBOX' || key.toUpperCase().includes('CAIXA DE ENTRADA')) return key;
                    if (list[key].children) {
                        const found = findInbox(list[key].children);
                        if (found) return found;
                    }
                }
                return 'INBOX';
            };
            const inboxName = findInbox(boxes);

            await connection.openBox(inboxName);
            const searchCriteria = [['UNSEEN'], ['SINCE', threeMonthsAgo]];
            const fetchOptions = { bodies: ['HEADER'], struct: true };
            const messages = await connection.search(searchCriteria, fetchOptions);

            if (messages.length > 0) {
                const uids = messages.map(m => m.attributes.uid);
                
                // Checa duplicatas
                const { data: existing } = await supabase
                    .from('email_messages_cache')
                    .select('uid')
                    .eq('account_id', config.id)
                    .in('uid', uids);
                
                const existingSet = new Set(existing?.map(e => e.uid) || []);
                const reallyNewMessages = messages.filter(m => !existingSet.has(m.attributes.uid));

                if (reallyNewMessages.length > 0) {
                    const toInsert = reallyNewMessages.map(msg => ({
                        account_id: config.id,
                        uid: msg.attributes.uid,
                        folder_path: inboxName,
                        subject: msg.parts[0].body.subject?.[0] || '(Sem Assunto)',
                        from_text: msg.parts[0].body.from?.[0] || '',
                        to_text: msg.parts[0].body.to?.[0] || '',
                        date: msg.parts[0].body.date?.[0] || new Date(),
                        is_read: false,
                        updated_at: new Date().toISOString()
                    }));
                    
                    // Salva e recupera os IDs gerados
                    for (let i = 0; i < toInsert.length; i += 50) {
                        const batch = toInsert.slice(i, i + 50);
                        const { data: insertedRows } = await supabase
                            .from('email_messages_cache')
                            .upsert(batch, { onConflict: 'account_id, folder_path, uid' })
                            .select('id, uid, account_id'); // Recupera o ID do banco
                        
                        // Se for apenas 1 mensagem nova no total, guarda ela para usar no link
                        if (reallyNewMessages.length === 1 && insertedRows && insertedRows.length > 0) {
                            singleNewMessageData = insertedRows[0];
                        }
                    }

                    totalNew += reallyNewMessages.length;
                }
            }
            connection.end();
        } catch (err) {
            console.error(`Erro conta ${config.email}:`, err.message);
            if (connection) connection.end();
        }
    }

    if (totalNew > 0) {
        let title = '📧 Novo E-mail!';
        let msg = `Você tem ${totalNew} novas mensagens.`;
        let linkId = null;

        // Se for só UM e-mail novo, o link vai direto pra ele
        if (totalNew === 1 && singleNewMessageData) {
             linkId = singleNewMessageData.id;
             msg = 'Toque para ler agora.';
        }

        await dispatchEmailNotification(supabase, user.id, title, msg, accounts[0].organizacao_id, linkId);
    }

    return { success: true, newEmails: totalNew };
}

export async function GET(request) {
    const result = await runEmailSync();
    return NextResponse.json(result);
}

export async function POST(request) {
    const result = await runEmailSync();
    return NextResponse.json(result);
}