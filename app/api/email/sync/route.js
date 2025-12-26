import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import webPush from 'web-push';

// --- 1. CONFIGURAÇÃO DAS CHAVES VAPID (PUSH) ---
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
        console.error("❌ [Email Sync] Erro na configuração VAPID:", err);
    }
}

// --- 2. FUNÇÃO DE NOTIFICAÇÃO ROBUSTA (IGUAL AO WHATSAPP) ---
async function dispatchEmailNotification(supabase, userId, title, message, organizationId) {
    try {
        // A. Salva no Sininho (Notificação interna do Sistema)
        await supabase.from('notificacoes').insert({
            user_id: userId,
            titulo: title,
            mensagem: message,
            link: '/caixa-de-entrada', // Link correto para o painel de e-mail
            lida: false,
            tipo: 'sistema',
            organizacao_id: organizationId, // Importante para filtros
            created_at: new Date().toISOString()
        });

        // B. Envia o Push para Celular/Desktop (Web Push)
        const { data: subscriptions } = await supabase
            .from('notification_subscriptions')
            .select('*')
            .eq('user_id', userId);

        if (subscriptions && subscriptions.length > 0) {
            console.log(`📱 [Email Sync] Disparando Push para ${subscriptions.length} dispositivos do usuário ${userId}.`);
            
            const payload = JSON.stringify({
                title: title,
                body: message, 
                url: '/caixa-de-entrada', // O Service Worker vai ler isso
                icon: '/icons/icon-192x192.png',
                tag: 'email-update' // Tag para agrupar notificações de e-mail separadas do WhatsApp
            });

            // Dispara para todos os dispositivos em paralelo
            const promises = subscriptions.map(sub => 
                webPush.sendNotification(sub.subscription_data, payload).catch(async err => {
                    // Se der erro 410 ou 404, a inscrição é velha e deve ser removida
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        console.log(`🗑️ [Email Sync] Removendo inscrição inativa: ${sub.id}`);
                        await supabase.from('notification_subscriptions').delete().eq('id', sub.id);
                    } else {
                        console.error(`⚠️ [Email Sync] Erro ao enviar push:`, err);
                    }
                })
            );
            
            await Promise.allSettled(promises);
        }
    } catch (e) {
        console.error("❌ [Email Sync] Erro fatal no envio de notificação:", e);
    }
}

// --- 3. UTILITÁRIOS IMAP ---
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

// --- 4. ROTA PRINCIPAL (POST) ---
export async function POST(request) {
    const supabase = await createClient();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    try {
        // Verifica autenticação
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // Busca configurações de e-mail do usuário
        const { data: accounts } = await supabase
            .from('email_configuracoes')
            .select('*')
            .eq('user_id', user.id);

        if (!accounts || accounts.length === 0) {
            return NextResponse.json({ success: true, message: 'Nenhuma conta configurada.' });
        }

        let totalSynced = 0;
        let newEmailsCountTotal = 0; // Contador geral de novidades nesta sincronização
        let organizacaoId = accounts[0].organizacao_id; // Pega a org da primeira conta

        for (const config of accounts) {
            let connection = null;
            try {
                // Configuração IMAP
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

                // Função recursiva para mapear pastas
                const processBoxes = (list, parentPath = '', level = 0) => {
                    for (const [key, val] of Object.entries(list)) {
                        const delimiter = val.delimiter || '/';
                        const fullPath = parentPath ? parentPath + delimiter + key : key;
                        // Pula pastas do sistema do Gmail que não interessam tanto na sync rápida
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
                        // Atualiza status da pasta (contagem não lida)
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

                        // Lógica de Detecção de Novos E-mails
                        // Focamos na Caixa de Entrada para notificar, para não spammar o usuário com Lixeira/Spam
                        const pathUpper = folder.path.toUpperCase();
                        const isInbox = pathUpper === 'INBOX' || pathUpper.includes('CAIXA DE ENTRADA') || pathUpper.includes('ENTRADA');
                        const isSent = pathUpper.includes('SENT') || pathUpper.includes('ENVIADOS');
                        
                        if (isInbox || isSent) {
                            await connection.openBox(folder.path, { readOnly: true });
                            
                            // Busca e-mails recentes (últimos 3 meses)
                            const searchCriteria = [['SINCE', threeMonthsAgo]];
                            const fetchOptions = { bodies: ['HEADER'], struct: true };
                            const messages = await connection.search(searchCriteria, fetchOptions);

                            if (messages.length > 0) {
                                const uids = messages.map(m => m.attributes.uid);
                                
                                // Verifica quais JÁ existem no banco para detectar quais são NOVOS de verdade
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
                                    
                                    // A MÁGICA: Se não está no banco AND não foi lido AND é Inbox -> É novidade!
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

                                // Salva em lotes de 50 para não travar o banco
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
                                
                                // Soma ao contador total de novidades da sessão
                                newEmailsCountTotal += newUnreadInThisFolder;
                            }
                        }
                    } catch (e) {
                        console.error(`Erro ao processar pasta ${folder.path}:`, e.message);
                    }
                }
                connection.end();
            } catch (e) { 
                console.error(`Erro na conta ${config.email}:`, e.message);
                if (connection) connection.end(); 
            }
        }

        // --- 5. DISPARO DA NOTIFICAÇÃO ---
        // Se houver novos e-mails detectados nesta rodada, avisa o usuário
        if (newEmailsCountTotal > 0) {
            const title = newEmailsCountTotal === 1 ? '📧 Novo E-mail Recebido!' : `📬 ${newEmailsCountTotal} Novos E-mails`;
            const msg = newEmailsCountTotal === 1 
                ? 'Você tem uma nova mensagem na Caixa de Entrada.'
                : `Você recebeu ${newEmailsCountTotal} mensagens novas. Clique para ver.`;
            
            // Chama nossa nova função poderosa
            await dispatchEmailNotification(supabase, user.id, title, msg, organizacaoId);
        }

        return NextResponse.json({ success: true, synced: totalSynced, newEmails: newEmailsCountTotal });

    } catch (error) {
        console.error("❌ [Email Sync] Erro Geral:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}