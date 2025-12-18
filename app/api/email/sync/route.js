import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import webPush from 'web-push';

// Configuração do WebPush (Reutilizando suas chaves)
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(
        'mailto:suporte@studio57.arq.br',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// Decodificador de Assunto (Para não chegar cheio de símbolos estranhos)
const decodeHeaderValue = (str) => {
    if (!str) return 'Sem assunto';
    if (Array.isArray(str)) str = str[0];
    const unfolded = str.replace(/\r\n\s+/g, ' ');
    const encodedWordRegex = /=\?([\w-]+)\?([BbQq])\?([^\?]*)\?=/g;
    if (!encodedWordRegex.test(unfolded)) return unfolded.replace(/^"|"$/g, '').trim();
    return unfolded.replace(encodedWordRegex, (match, charset, encoding, content) => {
        try {
            if (encoding.toUpperCase() === 'B') return Buffer.from(content, 'base64').toString('utf8');
            if (encoding.toUpperCase() === 'Q') return decodeURIComponent(escape(content.replace(/_/g, ' ')));
            return match;
        } catch (e) { return match; }
    });
};

export async function POST(request) {
    const supabase = createClient();

    try {
        // 1. Identificar Usuário
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // 2. Buscar Contas de E-mail
        const { data: accounts } = await supabase
            .from('email_configuracoes')
            .select('*')
            .eq('user_id', user.id);

        if (!accounts || accounts.length === 0) return NextResponse.json({ message: 'Sem contas' });

        // 3. Buscar Dispositivos para Notificar
        const { data: subscriptions } = await supabase
            .from('notification_subscriptions')
            .select('*')
            .eq('user_id', user.id);

        let totalNewEmails = 0;

        // 4. Processar cada conta
        for (const config of accounts) {
            let connection = null;
            try {
                const imapConfig = {
                    imap: {
                        user: config.imap_user || config.email,
                        password: config.senha_app,
                        host: config.imap_host,
                        port: config.imap_port || 993,
                        tls: true,
                        authTimeout: 10000,
                        tlsOptions: { rejectUnauthorized: false }
                    },
                };

                connection = await imapSimple.connect(imapConfig);
                const box = await connection.openBox('INBOX');
                
                // Pega o UID mais recente da caixa
                const latestUid = box.messages.total > 0 ? (await connection.search(['ALL'], { headers: ['uid'] })).pop()?.attributes?.uid : 0;
                
                // Se for a primeira vez (last_sync_uid == 0 ou null), apenas salva o atual para não notificar tudo
                if (!config.last_sync_uid || config.last_sync_uid === 0) {
                    await supabase.from('email_configuracoes').update({ last_sync_uid: latestUid }).eq('id', config.id);
                    connection.end();
                    continue; 
                }

                // Se não tem nada novo, pula
                if (latestUid <= config.last_sync_uid) {
                    connection.end();
                    continue;
                }

                // Busca as mensagens novas (UID maior que o último salvo)
                const searchCriteria = [['UID', '>', config.last_sync_uid]];
                const fetchOptions = { bodies: ['HEADER.FIELDS (FROM SUBJECT)'], struct: true };
                const newMessages = await connection.search(searchCriteria, fetchOptions);

                if (newMessages.length > 0) {
                    totalNewEmails += newMessages.length;

                    // Envia notificação para cada e-mail novo (Limitado a 3 para não spammar)
                    const notificationsToSend = newMessages.slice(-3); // Pega os 3 mais recentes

                    for (const msg of notificationsToSend) {
                        const header = msg.parts[0].body;
                        const subject = decodeHeaderValue(header.subject ? header.subject[0] : 'Novo E-mail');
                        const from = decodeHeaderValue(header.from ? header.from[0] : 'Remetente Desconhecido');
                        
                        const title = `📧 Novo e-mail de ${from.split('<')[0].trim()}`;
                        const messageBody = subject;
                        const link = '/admin/email'; // Link para abrir o e-mail

                        // A. Salva no Sininho (Banco)
                        await supabase.from('notificacoes').insert({
                            user_id: user.id,
                            titulo: title,
                            mensagem: messageBody,
                            link: link,
                            organizacao_id: config.organizacao_id,
                            lida: false
                        });

                        // B. Envia Push (Celular/Browser)
                        if (subscriptions?.length > 0) {
                            const payload = JSON.stringify({ title, message: messageBody, url: link, icon: '/icons/icon-192x192.png' });
                            subscriptions.forEach(sub => {
                                webPush.sendNotification(sub.subscription_data, payload).catch(err => {
                                    if (err.statusCode === 410) supabase.from('notification_subscriptions').delete().eq('id', sub.id);
                                });
                            });
                        }
                    }

                    // Atualiza o marcador no banco
                    const newMaxUid = Math.max(...newMessages.map(m => m.attributes.uid));
                    await supabase.from('email_configuracoes').update({ last_sync_uid: newMaxUid }).eq('id', config.id);
                }

                connection.end();

            } catch (err) {
                console.error(`Erro sync conta ${config.email}:`, err);
                if (connection) connection.end();
            }
        }

        return NextResponse.json({ success: true, newEmails: totalNewEmails });

    } catch (error) {
        console.error('Erro geral sync:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}