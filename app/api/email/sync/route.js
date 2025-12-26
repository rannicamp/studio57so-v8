import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import webPush from 'web-push';

// --- CONFIGURAÇÃO WEB PUSH ---
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(
        'mailto:suporte@studio57.arq.br',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// --- FUNÇÕES AUXILIARES ---
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

// --- FUNÇÃO DE NOTIFICAÇÃO HÍBRIDA (SISTEMA + MOBILE) ---
async function sendHybridNotification(supabase, userId, title, message) {
    try {
        console.log(`🔔 Disparando notificação para UserID: ${userId}`);

        // 1. GARANTIA DE SISTEMA: Salva no banco (Sininho) SEMPRE
        // Isso garante que apareça no painel web mesmo sem celular vinculado
        const { error: dbError } = await supabase.from('notificacoes').insert({
            user_id: userId,
            titulo: title,
            mensagem: message,
            link: '/email',
            lida: false,
            tipo: 'sistema' // Usa o ícone azul de sino (sistema) que já existe no seu frontend
        });

        if (dbError) console.error("Erro ao salvar notificação no sistema:", dbError);

        // 2. TENTATIVA MOBILE: Busca dispositivos para Push
        const { data: subscriptions } = await supabase
            .from('notification_subscriptions')
            .select('*')
            .eq('user_id', userId);

        // Se tiver celular cadastrado, manda o Push
        if (subscriptions && subscriptions.length > 0) {
            const payload = JSON.stringify({
                title: title,
                message: message,
                url: '/email', // Ao clicar na notificação do celular, abre o email
                icon: '/icons/icon-192x192.png'
            });

            const promises = subscriptions.map(sub => 
                webPush.sendNotification(sub.subscription_data, payload).catch(async err => {
                    // Limpeza automática de inscrições mortas
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        console.log(`🗑️ Removendo dispositivo inativo: ${sub.id}`);
                        await supabase.from('notification_subscriptions').delete().eq('id', sub.id);
                    }
                })
            );

            await Promise.all(promises);
            console.log(`📱 Push enviado para ${subscriptions.length} dispositivo(s).`);
        } else {
            console.log("ℹ️ Nenhum dispositivo móvel cadastrado para push. Notificação salva apenas no sistema.");
        }

    } catch (e) {
        console.error("Erro geral no envio de notificação:", e);
    }
}

export async function POST(request) {
    const supabase = await createClient();
    
    // Busca e-mails dos últimos 3 meses (janela de sincronização)
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
        let newEmailsCountTotal = 0; 

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

                // Mapeia estrutura de pastas
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

                        // Atualiza cache de contagem da pasta
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

                        // Para notificações, focamos principalmente na Caixa de Entrada
                        const isInbox = ['INBOX', 'CAIXA DE ENTRADA', 'ENTRADA'].some(k => folder.path.toUpperCase() === k);
                        
                        // Sincroniza conteúdo apenas de pastas relevantes (Entrada e Enviados)
                        const isRelevant = isInbox || ['SENT', 'ENVIADOS', 'ITENS ENVIADOS'].some(k => folder.path.toUpperCase().includes(k));
                        
                        if (isRelevant) {
                            await connection.openBox(folder.path, { readOnly: true });
                            
                            const searchCriteria = [['SINCE', threeMonthsAgo]];
                            const fetchOptions = { bodies: ['HEADER'], struct: true };
                            const messages = await connection.search(searchCriteria, fetchOptions);

                            if (messages.length > 0) {
                                // Verifica quais mensagens já temos no banco para saber se são novas
                                const uids = messages.map(m => m.attributes.uid);
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
                                    
                                    // Se não está no banco E não foi lido E é na Inbox -> Conta como novidade
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
                                        is_read: !isRead, // Inverte a lógica (banco is_read vs imap unseen)
                                        updated_at: new Date().toISOString()
                                    });
                                });

                                // Upsert em lotes
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

                    } catch (folderErr) {
                        console.warn(`Pulei pasta ${folder.path}:`, folderErr.message);
                    }
                }
                connection.end();
            } catch (connErr) {
                console.error(`Erro conexão ${config.email}:`, connErr);
                if (connection) connection.end();
            }
        }

        // --- DISPARO DE NOTIFICAÇÃO INTELIGENTE ---
        if (newEmailsCountTotal > 0) {
            const title = newEmailsCountTotal === 1 ? 'Novo E-mail Recebido 📧' : `${newEmailsCountTotal} Novos E-mails 📬`;
            const msg = newEmailsCountTotal === 1 
                ? 'Você recebeu uma nova mensagem na sua caixa de entrada.'
                : `Sua caixa de entrada tem ${newEmailsCountTotal} novas mensagens não lidas.`;
            
            // Chama a nova função híbrida
            await sendHybridNotification(supabase, user.id, title, msg);
        }

        return NextResponse.json({ success: true, synced: totalSynced, newEmails: newEmailsCountTotal });

    } catch (error) {
        console.error("Erro geral na API Sync:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}