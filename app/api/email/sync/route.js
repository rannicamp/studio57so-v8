// app/api/email/sync/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { enviarNotificacao } from '@/utils/notificacoes'; // <--- O Carteiro Central

async function runEmailSync() {
    const supabase = await createClient();
    
    // Reduzimos a janela de busca para evitar sobrecarga (1 mês)
    const searchWindow = new Date();
    searchWindow.setMonth(searchWindow.getMonth() - 1);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Sem usuário na sessão (Cron requer Service Role ou Sessão Ativa)' };

    const { data: accounts } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
    if (!accounts?.length) return { message: 'Sem contas configuradas' };

    let totalNotificationWorthy = 0; 
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
                
                // Batching para evitar erro de memória
                const existingSet = new Set();
                const chunkSize = 100; 
                
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
                        
                        // Lógica de Notificação Inteligente (Apenas recentes < 60min)
                        if (insertedRows) {
                            insertedRows.forEach(row => {
                                const emailDate = new Date(row.date);
                                const now = new Date();
                                const diffMinutes = (now - emailDate) / 1000 / 60;

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

    // --- DISPARO CENTRALIZADO ---
    if (totalNotificationWorthy > 0) {
        let title = '📧 Novo E-mail!';
        let msg = `Você tem ${totalNotificationWorthy} novas mensagens.`;
        let linkUrl = '/caixa-de-entrada';

        // Se for só UM e-mail novo RECENTE, link direto
        if (totalNotificationWorthy === 1 && singleNewMessageData) {
             linkUrl = `/caixa-de-entrada?email_id=${singleNewMessageData.id}`;
             msg = 'Toque para ler agora.';
        }

        // Chama a central
        await enviarNotificacao({
            userId: user.id,
            titulo: title,
            mensagem: msg,
            link: linkUrl,
            tipo: 'email_novo',
            organizacaoId: accounts[0].organizacao_id,
            canal: 'sistema', // Podemos criar um canal 'email' nas preferencias depois
            supabaseClient: supabase // Reutiliza a conexão
        });
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