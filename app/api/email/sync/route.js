import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; 

export async function POST(request) {
    const supabase = await createClient();
    let connection = null;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // 1. Busca contas configuradas
        const { data: accounts } = await supabase
            .from('email_configuracoes')
            .select('*')
            .eq('user_id', user.id);

        if (!accounts || accounts.length === 0) {
            return NextResponse.json({ message: 'Nenhuma conta configurada.', totalNew: 0 });
        }

        let totalSynced = 0;

        // 2. Loop por conta
        for (const config of accounts) {
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
                
                // 3. Descobre TODAS as pastas
                const boxes = await connection.getBoxes();
                const allFolders = getAllFolderPaths(boxes);

                // Prioriza INBOX
                const inboxIndex = allFolders.findIndex(f => f.toUpperCase() === 'INBOX');
                if (inboxIndex > 0) {
                    allFolders.unshift(allFolders.splice(inboxIndex, 1)[0]);
                }

                // 4. Varre pasta por pasta
                for (const folderPath of allFolders) {
                    try {
                        await connection.openBox(folderPath, { readOnly: true });

                        // Pergunta ao banco: "Qual o maior UID que eu já tenho desta pasta?"
                        const { data: maxUidData } = await supabase
                            .from('email_messages_cache')
                            .select('uid')
                            .eq('account_id', config.id)
                            .eq('folder_path', folderPath)
                            .order('uid', { ascending: false })
                            .limit(1)
                            .single();

                        const lastUid = maxUidData?.uid || 0;
                        
                        // Busca no IMAP
                        const searchCriteria = [['UID', `${lastUid + 1}:*`]];
                        
                        const fetchOptions = {
                            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)'],
                            struct: true,
                            markSeen: false 
                        };

                        const messages = await connection.search(searchCriteria, fetchOptions);
                        
                        if (messages.length === 0) continue;

                        const batchSize = 100;
                        for (let i = 0; i < messages.length; i += batchSize) {
                            const batch = messages.slice(i, i + batchSize);
                            const upsertData = [];

                            for (const message of batch) {
                                const part = message.parts.find(p => p.which && p.which.includes('HEADER'));
                                const headers = part?.body || {};

                                const subject = headers.subject ? headers.subject[0] : '(Sem Assunto)';
                                const from = headers.from ? headers.from[0] : '';
                                const date = headers.date ? new Date(headers.date[0]) : new Date();

                                // --- CORREÇÃO AQUI: Verifica as flags reais do servidor ---
                                const flags = message.attributes.flags || [];
                                // Verifica se tem a flag \Seen (Lido). Usamos toUpperCase para garantir.
                                const isRead = flags.some(f => f.toString().toUpperCase().includes('SEEN'));

                                upsertData.push({
                                    account_id: config.id,
                                    uid: message.attributes.uid,
                                    folder_path: folderPath,
                                    subject: decodeHeader(subject).substring(0, 200),
                                    from_text: decodeHeader(from).substring(0, 100),
                                    date: date,
                                    is_read: isRead, // <--- Agora usa o valor real!
                                    conteudo_cache: null, 
                                    html_body: null,
                                    text_body: null,
                                    has_attachments: false, 
                                    updated_at: new Date().toISOString()
                                });
                            }

                            if (upsertData.length > 0) {
                                // O Upsert mantém ignoreDuplicates: true para ser rápido em novos
                                // Mas como você vai limpar a tabela, ele vai inserir tudo certo agora.
                                await supabase
                                    .from('email_messages_cache')
                                    .upsert(upsertData, { 
                                        onConflict: 'account_id, folder_path, uid',
                                        ignoreDuplicates: true 
                                    });
                                totalSynced += upsertData.length;
                            }
                        }

                    } catch (folderError) {
                        console.error(`Erro ao sincronizar pasta ${folderPath}:`, folderError.message);
                    }
                }

                connection.end();

            } catch (err) {
                console.error(`Erro conta ${config.email}:`, err);
                if (connection) try { connection.end(); } catch {}
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Sync completo. ${totalSynced} itens processados.`, 
            totalNew: totalSynced 
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Funções auxiliares (mantidas iguais)
function getAllFolderPaths(boxes, parentPath = '') {
    let paths = [];
    for (const [key, value] of Object.entries(boxes)) {
        const delimiter = value.delimiter || '/';
        const fullPath = parentPath ? parentPath + delimiter + key : key;
        
        if (!value.attribs || !value.attribs.some(a => typeof a === 'string' && a.toLowerCase().includes('noselect'))) {
             paths.push(fullPath);
        }

        if (value.children) {
            paths = paths.concat(getAllFolderPaths(value.children, fullPath));
        }
    }
    return paths;
}

function decodeHeader(str) {
    if (!str) return '';
    return str.replace(/=\?([\w-]+)\?([BbQq])\?([^\?]*)\?=/g, (match, charset, encoding, content) => {
        try {
            if (encoding.toUpperCase() === 'B') {
                return Buffer.from(content, 'base64').toString('utf8');
            } else if (encoding.toUpperCase() === 'Q') {
                return decodeURIComponent(content.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, '%$1'));
            }
        } catch (e) { return match; }
        return match;
    });
}