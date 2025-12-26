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
async function dispatchEmailNotification(supabase, userId, title, message, organizacaoId) {
    try {
        // 1. Salva no Sininho
        await supabase.from('notificacoes').insert({
            user_id: userId,
            titulo: title,
            mensagem: message,
            link: '/caixa-de-entrada',
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
                url: '/caixa-de-entrada',
                icon: '/icons/icon-192x192.png',
                tag: 'email-update' // Tag específica para E-mail
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

// --- LÓGICA PRINCIPAL DO SYNC ---
async function runEmailSync() {
    const supabase = await createClient();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Precisamos de acesso "admin" para rodar para todos os usuários se for via Cron
    // Mas aqui vamos usar a sessão atual se for chamado via frontend, ou buscar todos se for cron.
    // Simplificação: Vamos focar no usuário logado ou varrer configurações ativas.
    
    // NOTA: Para CRON real, precisaríamos usar 'supabaseAdmin' (service_role), 
    // mas por segurança vamos manter via user session por enquanto para o teste manual funcionar.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Sem usuário na sessão (Cron requer Service Role)' };

    const { data: accounts } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
    if (!accounts?.length) return { message: 'Sem contas configuradas' };

    let totalNew = 0;

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

            await connection.openBox('INBOX');
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
                    // Salva no cache
                    const toInsert = reallyNewMessages.map(msg => ({
                        account_id: config.id,
                        uid: msg.attributes.uid,
                        folder_path: 'INBOX',
                        subject: msg.parts[0].body.subject?.[0] || '(Sem Assunto)',
                        from_text: msg.parts[0].body.from?.[0] || '',
                        to_text: msg.parts[0].body.to?.[0] || '',
                        date: msg.parts[0].body.date?.[0] || new Date(),
                        is_read: false,
                        updated_at: new Date().toISOString()
                    }));
                    
                    // Upsert seguro
                    for (let i = 0; i < toInsert.length; i += 50) {
                        await supabase.from('email_messages_cache').upsert(toInsert.slice(i, i + 50), { onConflict: 'account_id, folder_path, uid' });
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
        await dispatchEmailNotification(supabase, user.id, '📧 Novo E-mail!', `Você tem ${totalNew} novas mensagens.`, accounts[0].organizacao_id);
    }

    return { success: true, newEmails: totalNew };
}

// Rota GET (Para Cron Jobs ou teste rápido no navegador)
export async function GET(request) {
    const result = await runEmailSync();
    return NextResponse.json(result);
}

// Rota POST (Para o Frontend chamar)
export async function POST(request) {
    const result = await runEmailSync();
    return NextResponse.json(result);
}