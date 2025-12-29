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
                url: targetUrl,
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
    // Reduzimos a janela de busca para evitar sobrecarga (1 mês em vez de 3)
    const searchWindow = new Date();
    searchWindow.setMonth(searchWindow.getMonth() - 1);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Sem usuário na sessão (Cron requer Service Role)' };

    const { data: accounts } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
    if (!accounts?.length) return { message: 'Sem contas configuradas' };

    let totalNotificationWorthy = 0; // Contador APENAS para notificações RECENTES
    let singleNewMessageData = null; 

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
            const searchCriteria = [['UNSEEN'], ['SINCE', searchWindow]];
            const fetchOptions = { bodies: ['HEADER'], struct: true };
            const messages = await connection.search(searchCriteria, fetchOptions);

            if (messages.length > 0) {
                const uids = messages.map(m => m.attributes.uid);
                
                // --- CORREÇÃO 1: Batching (Lotes) para evitar erro de memória ---
                const existingSet = new Set();
                const chunkSize = 100; // Verifica em lotes menores
                
                for (let i = 0; i < uids.length; i += chunkSize) {
                    const chunk = uids.slice(i, i + chunkSize);
                    const { data: existingBatch } = await supabase
                        .from('email_messages_cache')
                        .select('uid')
                        .eq('account_id', config.id)
                        .in('uid', chunk);
                    
                    existingBatch?.forEach(e => existingSet.add(e.uid));
                }
                
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
                    
                    // Salva em lotes
                    for (let i = 0; i < toInsert.length; i += 50) {
                        const batch = toInsert.slice(i, i + 50);
                        const { data: insertedRows } = await supabase
                            .from('email_messages_cache')
                            .upsert(batch, { onConflict: 'account_id, folder_path, uid' })
                            .select('id, uid, account_id, date'); 
                        
                        // --- CORREÇÃO 2: Só notifica se for RECENTE (últimos 60 min) ---
                        if (insertedRows) {
                            insertedRows.forEach(row => {
                                const emailDate = new Date(row.date);
                                const now = new Date();
                                // Diferença em minutos
                                const diffMinutes = (now - emailDate) / 1000 / 60;

                                // Se o e-mail chegou há menos de 60 minutos, conta para notificação.
                                // Se for e-mail de 3 meses atrás que estava não lido, salva mas NÃO notifica.
                                if (diffMinutes < 60) {
                                    totalNotificationWorthy++;
                                    singleNewMessageData = row;
                                }
                            });
                        }
                    }
                }
            }
            connection.end();
        } catch (err) {
            console.error(`Erro conta ${config.email}:`, err.message);
            if (connection) connection.end();
        }
    }

    // Só dispara se tiver e-mails RECENTES
    if (totalNotificationWorthy > 0) {
        let title = '📧 Novo E-mail!';
        let msg = `Você tem ${totalNotificationWorthy} novas mensagens.`;
        let linkId = null;

        if (totalNotificationWorthy === 1 && singleNewMessageData) {
             linkId = singleNewMessageData.id;
             msg = 'Toque para ler agora.';
        }

        await dispatchEmailNotification(supabase, user.id, title, msg, accounts[0].organizacao_id, linkId);
    }

    return { success: true, newEmails: totalNotificationWorthy };
}

export async function GET(request) {
    const result = await runEmailSync();
    return NextResponse.json(result);
}

export async function POST(request) {
    const result = await runEmailSync();
    return NextResponse.json(result);
}