import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

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
    // Await obrigatório no Next 15
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

                // Lógica de caminhos corrigida (Igual ao route.js de folders)
                const processBoxes = (list, parentPath = '', level = 0) => {
                    for (const [key, val] of Object.entries(list)) {
                        const delimiter = val.delimiter || '/';
                        const fullPath = parentPath ? parentPath + delimiter + key : key;

                        // Se for [Gmail], passamos o caminho para os filhos mas não processamos este nó
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
                        // Verifica status (se falhar, ignora pasta sem travar sync)
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

                        // Sincroniza apenas pastas principais para performance
                        const isRelevant = ['INBOX', 'SENT', 'ENVIADOS', 'ENTRADA', 'ITENS ENVIADOS'].some(k => folder.path.toUpperCase().includes(k));
                        
                        if (isRelevant) {
                            // Importante: readOnly true previne alterar flags acidentalmente durante sync
                            await connection.openBox(folder.path, { readOnly: true });
                            
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
                                };
                            });

                            if (messagesToUpsert.length > 0) {
                                // Upsert em lotes
                                for (let i = 0; i < messagesToUpsert.length; i += 50) {
                                    const batch = messagesToUpsert.slice(i, i + 50);
                                    await supabase.from('email_messages_cache').upsert(batch, { 
                                        onConflict: 'account_id, folder_path, uid',
                                        ignoreDuplicates: false 
                                    });
                                }
                                totalSynced += messagesToUpsert.length;
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

        return NextResponse.json({ success: true, synced: totalSynced });

    } catch (error) {
        console.error("Erro geral na API Sync:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}