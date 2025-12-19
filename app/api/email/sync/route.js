import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

// Função auxiliar para decodificar headers
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

export async function POST(request) {
    const supabase = createClient();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // Pega todas as contas
        const { data: accounts } = await supabase
            .from('email_configuracoes')
            .select('*')
            .eq('user_id', user.id);

        let totalSynced = 0;

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
                
                // 1. SINCRONIZAR PASTAS E CONTADORES
                const boxes = await connection.getBoxes();
                const folderList = [];

                const processBoxes = (list, parent = '', level = 0) => {
                    for (const [key, val] of Object.entries(list)) {
                        const path = parent ? `${parent}${val.delimiter}${key}` : key;
                        folderList.push({ name: key, path, delimiter: val.delimiter, level });
                        if (val.children) processBoxes(val.children, path, level + 1);
                    }
                };
                processBoxes(boxes);

                for (const folder of folderList) {
                    try {
                        const status = await connection.status(folder.path, { unseen: true, messages: true });
                        
                        // Upsert na tabela de cache de pastas
                        await supabase.from('email_folders_cache').upsert({
                            account_id: config.id,
                            path: folder.path,
                            name: folder.name,
                            display_name: folder.name, // Pode melhorar tradução aqui depois
                            unseen_count: status.unseen || 0,
                            total_count: status.messages || 0,
                            level: folder.level,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'account_id, path' });

                        // 2. SINCRONIZAR MENSAGENS (Apenas Inbox e Enviados para performance inicial)
                        // Se quiser todas, remova o 'if'. Mas cuidado com timeouts.
                        const isRelevant = ['INBOX', 'SENT', 'ENVIADOS', 'ENTRADA'].some(k => folder.path.toUpperCase().includes(k));
                        
                        if (isRelevant) {
                            await connection.openBox(folder.path);
                            // Busca mensagens desde 3 meses atrás
                            const searchCriteria = [['SINCE', threeMonthsAgo]];
                            const fetchOptions = { bodies: ['HEADER'], struct: true };
                            const messages = await connection.search(searchCriteria, fetchOptions);

                            const messagesToUpsert = messages.map(msg => {
                                const header = msg.parts[0].body;
                                return {
                                    account_id: config.id,
                                    uid: msg.attributes.uid,
                                    folder_path: folder.path,
                                    subject: decodeHeader(header.subject ? header.subject[0] : '(Sem Assunto)'),
                                    from_text: decodeHeader(header.from ? header.from[0] : ''),
                                    date: header.date ? new Date(header.date[0]) : new Date(),
                                    is_read: !msg.attributes.flags.includes('\\Seen'),
                                    updated_at: new Date().toISOString()
                                    // Nota: Não baixamos o corpo aqui para não estourar a memória. 
                                    // O corpo é baixado sob demanda no 'content/route.js' e salvo no cache.
                                };
                            });

                            if (messagesToUpsert.length > 0) {
                                // Upsert em lotes de 50 para não travar o banco
                                for (let i = 0; i < messagesToUpsert.length; i += 50) {
                                    const batch = messagesToUpsert.slice(i, i + 50);
                                    await supabase.from('email_messages_cache').upsert(batch, { 
                                        onConflict: 'account_id, folder_path, uid',
                                        ignoreDuplicates: false // Atualiza flags (lido/não lido)
                                    });
                                }
                                totalSynced += messagesToUpsert.length;
                            }
                        }

                    } catch (folderErr) {
                        console.error(`Erro sync pasta ${folder.path}:`, folderErr.message);
                    }
                }
                connection.end();

            } catch (connErr) {
                console.error(`Erro conexão ${config.email}:`, connErr);
            }
        }

        return NextResponse.json({ success: true, synced: totalSynced });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}