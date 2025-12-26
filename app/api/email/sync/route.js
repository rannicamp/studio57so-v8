import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import webPush from 'web-push'; // Já existe no seu projeto!

// --- CONFIGURAÇÃO WEB PUSH (Igual do WhatsApp) ---
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
        console.error("Erro config VAPID:", err);
    }
}

// --- FUNÇÃO DE NOTIFICAÇÃO (SISTEMA + MOBILE) ---
async function sendHybridNotification(supabase, userId, title, message) {
    try {
        // 1. Salva no Sininho (Sistema)
        await supabase.from('notificacoes').insert({
            user_id: userId,
            titulo: title,
            mensagem: message,
            link: '/email', // Ao clicar no sininho, vai pro e-mail
            lida: false,
            tipo: 'sistema',
            created_at: new Date().toISOString()
        });

        // 2. Busca Celulares para Push (Mesma tabela do WhatsApp)
        const { data: subscriptions } = await supabase
            .from('notification_subscriptions')
            .select('*')
            .eq('user_id', userId);

        if (subscriptions && subscriptions.length > 0) {
            console.log(`📱 Enviando Push para ${subscriptions.length} dispositivos.`);
            
            const payload = JSON.stringify({
                title: title,
                body: message, // 'body' é o padrão mobile
                url: '/email',
                icon: '/icons/icon-192x192.png'
            });

            const promises = subscriptions.map(sub => 
                webPush.sendNotification(sub.subscription_data, payload).catch(async err => {
                    // Limpa inscrições mortas (410 = Gone)
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await supabase.from('notification_subscriptions').delete().eq('id', sub.id);
                    }
                })
            );
            await Promise.all(promises);
        }
    } catch (e) {
        console.error("Erro enviando notificação:", e);
    }
}

const decodeHeader = (str) => {
    if (!str) return '';
    if (Array.isArray(str)) str = str[0];
    try {
        return str.replace(/=\?([\w-]+)\?([BbQq])\?([^\?]*)\?=/g, (match, charset, encoding, content) => {
            if (encoding.toUpperCase() === 'B') return Buffer.from(content, 'base64').toString('utf8');
            if (encoding.toUpperCase() === 'Q') return decodeURIComponent(escape(content.replace(/_/g, ' ')));
            return match;
        });
    } catch { return str; }
};

const getBoxStatus = (connection, boxName) => {
    return new Promise((resolve) => {
        connection.imap.status(boxName, (err, box) => {
            if (err) resolve(null);
            else resolve(box);
        });
    });
};

export async function POST(request) {
    const supabase = await createClient();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const { data: accounts } = await supabase
            .from('email_configuracoes')
            .select('*')
            .eq('user_id', user.id);

        let totalSynced = 0;
        let newEmailsCountTotal = 0; // Contador de novidades

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
                        authTimeout: 20000,
                        tlsOptions: { rejectUnauthorized: false }
                    },
                };

                connection = await imapSimple.connect(imapConfig);
                const boxes = await connection.getBoxes();
                const folderList = [];

                const processBoxes = (list, parentPath = '', level = 0) => {
                    for (const [key, val] of Object.entries(list)) {
                        const delimiter = val.delimiter || '/';
                        const fullPath = parentPath ? parentPath + delimiter + key : key;
                        if (key === '[Gmail]' || key === '[Google Mail]') {
                            if (val.children) processBoxes(val.children, fullPath, level);
                            continue;
                        }
                        folderList.push({ name: key, path: fullPath, delimiter: val.delimiter, level });
                        if (val.children) processBoxes(val.children, fullPath, level + 1);
                    }
                };
                processBoxes(boxes);

                for (const folder of folderList) {
                    try {
                        const status = await getBoxStatus(connection, folder.path);
                        if (!status) continue;

                        await supabase.from('email_folders_cache').upsert({
                            account_id: config.id,
                            path: folder.path,
                            name: folder.name,
                            display_name: folder.name, 
                            unseen_count: status.unseen || 0,
                            total_count: status.messages || 0,
                            level: folder.level,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'account_id, path' });

                        // Foca na Caixa de Entrada para notificar
                        const isInbox = ['INBOX', 'CAIXA DE ENTRADA', 'ENTRADA'].some(k => folder.path.toUpperCase() === k);
                        const isRelevant = isInbox || ['SENT', 'ENVIADOS'].some(k => folder.path.toUpperCase().includes(k));
                        
                        if (isRelevant) {
                            await connection.openBox(folder.path, { readOnly: true });
                            
                            const searchCriteria = [['SINCE', threeMonthsAgo]];
                            const fetchOptions = { bodies: ['HEADER'], struct: true };
                            const messages = await connection.search(searchCriteria, fetchOptions);

                            if (messages.length > 0) {
                                const uids = messages.map(m => m.attributes.uid);
                                
                                // Verifica quais JÁ existem no banco para detectar NOVOS
                                const { data: existingMessages } = await supabase
                                    .from('email_messages_cache')
                                    .select('uid')
                                    .eq('account_id', config.id)
                                    .eq('folder_path', folder.path)
                                    .in('uid', uids);

                                const existingSet = new Set(existingMessages?.map(m => m.uid) || []);
                                const messagesToUpsert = [];
                                let newUnreadInThisFolder = 0;

                                messages.forEach(msg => {
                                    const uid = msg.attributes.uid;
                                    const header = msg.parts[0].body;
                                    const isRead = msg.attributes.flags.includes('\\Seen');
                                    
                                    // SE NÃO EXISTE NO BANCO + NÃO LIDO + É INBOX = NOVIDADE!
                                    if (!existingSet.has(uid) && !isRead && isInbox) {
                                        newUnreadInThisFolder++;
                                    }

                                    messagesToUpsert.push({
                                        account_id: config.id,
                                        uid: uid,
                                        folder_path: folder.path,
                                        subject: decodeHeader(header.subject ? header.subject[0] : '(Sem Assunto)'),
                                        from_text: decodeHeader(header.from ? header.from[0] : ''),
                                        to_text: decodeHeader(header.to ? header.to[0] : ''),
                                        date: header.date ? new Date(header.date[0]) : new Date(),
                                        is_read: !isRead, // Inverte pois IMAP usa \Seen
                                        updated_at: new Date().toISOString()
                                    });
                                });

                                if (messagesToUpsert.length > 0) {
                                    for (let i = 0; i < messagesToUpsert.length; i += 50) {
                                        const batch = messagesToUpsert.slice(i, i + 50);
                                        await supabase.from('email_messages_cache').upsert(batch, { 
                                            onConflict: 'account_id, folder_path, uid',
                                            ignoreDuplicates: false 
                                        });
                                    }
                                    totalSynced += messagesToUpsert.length;
                                }
                                newEmailsCountTotal += newUnreadInThisFolder;
                            }
                        }
                    } catch (e) {}
                }
                connection.end();
            } catch (e) { if (connection) connection.end(); }
        }

        // --- DISPARO IMEDIATO ---
        if (newEmailsCountTotal > 0) {
            const title = newEmailsCountTotal === 1 ? 'Novo E-mail! 📧' : `${newEmailsCountTotal} Novos E-mails 📬`;
            const msg = newEmailsCountTotal === 1 
                ? 'Chegou mensagem nova na Caixa de Entrada.'
                : `Você tem ${newEmailsCountTotal} novas mensagens.`;
            
            // Chama a função que manda pro Banco (Sino) E pro Push (Celular)
            await sendHybridNotification(supabase, user.id, title, msg);
        }

        return NextResponse.json({ success: true, synced: totalSynced, newEmails: newEmailsCountTotal });

    } catch (error) {
        console.error("Erro Sync:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}