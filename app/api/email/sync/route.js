import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

// Configuração para permitir execução mais longa (60s é o limite comum em Serverless)
export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

// Função auxiliar para processar uma pasta específica
async function syncFolder(connection, dbConfigId, folderName, supabase) {
    try {
        await connection.openBox(folderName);
        
        // 1. Busca APENAS UIDs e Flags de TUDO (Modo Leve 🪶)
        // Removemos qualquer filtro de data. É ['ALL'].
        // 'bodies: []' significa que não baixamos cabeçalhos ainda, só a estrutura básica.
        const searchCriteria = ['ALL'];
        const fetchOptions = { bodies: [], struct: true, markSeen: false };
        const imapMessages = await connection.search(searchCriteria, fetchOptions);
        
        // Mapa: UID -> { flags }
        const imapMap = new Map();
        imapMessages.forEach(msg => {
            imapMap.set(msg.attributes.uid, {
                flags: msg.attributes.flags || []
            });
        });

        // 2. Busca TODOS os UIDs que já temos no Banco para essa pasta
        // Precisamos saber tudo o que já temos para saber o que falta
        const { data: dbMessages } = await supabase
            .from('email_messages_cache')
            .select('uid, is_read')
            .eq('account_id', dbConfigId)
            .eq('folder_path', folderName);

        const dbMap = new Map();
        dbMessages?.forEach(msg => dbMap.set(msg.uid, msg));

        // --- A. FAXINA: REMOVER E-MAILS DELETADOS ---
        // Se está no Banco mas não está mais no IMAP, deleta.
        const uidsToDelete = [];
        dbMap.forEach((val, uid) => {
            if (!imapMap.has(uid)) uidsToDelete.push(uid);
        });

        if (uidsToDelete.length > 0) {
            // Deleta em lotes para não estourar a query
            for (let i = 0; i < uidsToDelete.length; i += 100) {
                const batch = uidsToDelete.slice(i, i + 100);
                await supabase.from('email_messages_cache')
                    .delete()
                    .eq('account_id', dbConfigId)
                    .eq('folder_path', folderName)
                    .in('uid', batch);
            }
            console.log(`🗑️ [${folderName}] ${uidsToDelete.length} e-mails removidos.`);
        }

        // --- B. ATUALIZAR STATUS (LIDO/NÃO LIDO) ---
        const uidsToMarkRead = [];
        const uidsToMarkUnread = [];

        imapMap.forEach((val, uid) => {
            if (dbMap.has(uid)) {
                const dbIsRead = dbMap.get(uid).is_read;
                const imapIsRead = val.flags.includes('\\Seen');

                if (imapIsRead && !dbIsRead) uidsToMarkRead.push(uid);
                if (!imapIsRead && dbIsRead) uidsToMarkUnread.push(uid);
            }
        });

        // Atualiza em lotes
        if (uidsToMarkRead.length > 0) {
             for (let i = 0; i < uidsToMarkRead.length; i += 100) {
                const batch = uidsToMarkRead.slice(i, i + 100);
                await supabase.from('email_messages_cache').update({ is_read: true }).eq('account_id', dbConfigId).eq('folder_path', folderName).in('uid', batch);
             }
        }
        if (uidsToMarkUnread.length > 0) {
            for (let i = 0; i < uidsToMarkUnread.length; i += 100) {
                const batch = uidsToMarkUnread.slice(i, i + 100);
                await supabase.from('email_messages_cache').update({ is_read: false }).eq('account_id', dbConfigId).eq('folder_path', folderName).in('uid', batch);
            }
        }

        // --- C. BAIXAR O QUE FALTA (O PULO DO GATO 🐈) ---
        // Filtramos os UIDs que estão no IMAP mas NÃO estão no Banco
        const missingUids = Array.from(imapMap.keys())
            .filter(uid => !dbMap.has(uid))
            .sort((a, b) => b - a); // <--- ORDENAÇÃO DESCRESCE: Do maior (novo) para o menor (velho)

        // Pegamos um lote seguro (ex: 50 e-mails por vez)
        // Isso impede timeout. Na próxima execução, ele pega os próximos 50.
        const uidsToDownload = missingUids.slice(0, 50); 

        if (uidsToDownload.length > 0) {
            console.log(`📥 [${folderName}] Baixando ${uidsToDownload.length} novos de um total de ${missingUids.length} pendentes...`);
            
            // Agora sim baixamos o corpo desses 50 e-mails
            const fullMessages = await connection.search([['UID', uidsToDownload]], {
                bodies: [''], 
                markSeen: false
            });

            const recordsToInsert = [];

            for (const msg of fullMessages) {
                try {
                    const allParts = msg.parts.find(part => part.which === '');
                    const parsed = await simpleParser(allParts.body);

                    const emailData = {
                        id: msg.attributes.uid,
                        subject: parsed.subject,
                        from: parsed.from?.text,
                        to: parsed.to?.text,
                        cc: parsed.cc?.text,
                        date: parsed.date,
                        html: parsed.html || false,
                        text: parsed.textAsHtml || parsed.text,
                        // ANEXOS: Apenas Metadados (Nome, Tamanho, Tipo)
                        attachments: parsed.attachments.map(att => ({
                            filename: att.filename,
                            contentType: att.contentType,
                            size: att.size,
                            // Content removido para não pesar o banco
                        }))
                    };

                    recordsToInsert.push({
                        account_id: dbConfigId,
                        uid: msg.attributes.uid,
                        folder_path: folderName,
                        subject: parsed.subject || '(Sem Assunto)',
                        from_text: parsed.from?.text || '',
                        to_text: parsed.to?.text || '', 
                        cc_text: parsed.cc?.text || '',
                        date: parsed.date || new Date(),
                        is_read: msg.attributes.flags.includes('\\Seen'),
                        conteudo_cache: emailData,
                        updated_at: new Date().toISOString()
                    });
                } catch (parseErr) {
                    console.error(`Erro parse msg ${msg.attributes.uid}:`, parseErr);
                }
            }

            if (recordsToInsert.length > 0) {
                const { error } = await supabase.from('email_messages_cache').upsert(recordsToInsert, { 
                    onConflict: 'account_id, folder_path, uid' 
                });
                if (error) console.error("Erro insert cache:", error);
            }
        }
        
        return { 
            new: uidsToDownload.length, 
            pending: Math.max(0, missingUids.length - 50),
            deleted: uidsToDelete.length, 
            updated: uidsToMarkRead.length + uidsToMarkUnread.length 
        };

    } catch (err) {
        console.error(`Erro sync pasta ${folderName}:`, err);
        return { error: err.message };
    }
}

export async function POST(request) {
    const supabase = await createClient();
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // Busca contas
        const { data: accounts } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
        if (!accounts?.length) return NextResponse.json({ message: 'Sem contas' });

        const stats = { totalNew: 0, totalPending: 0 };

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
                const criticalFolders = [];

                // Prioriza pastas principais para sincronizar primeiro
                const traverse = (list, parent = '') => {
                    for (const key in list) {
                        const delimiter = list[key].delimiter || '/';
                        const fullPath = parent ? parent + delimiter + key : key;
                        const nameUpper = key.toUpperCase();

                        if (nameUpper.includes('INBOX') || 
                            nameUpper.includes('SENT') || nameUpper.includes('ENVIAD') || 
                            nameUpper.includes('DRAFT') || nameUpper.includes('RASCUNHO') ||
                            nameUpper.includes('TRASH') || nameUpper.includes('LIXEIRA')) {
                            criticalFolders.push(fullPath);
                        } else {
                            // Adiciona outras pastas no final da fila se der tempo
                            // (Por enquanto, focamos nas principais para performance)
                        }
                        
                        if (list[key].children) traverse(list[key].children, fullPath);
                    }
                };
                traverse(boxes);
                if (!criticalFolders.some(f => f.toUpperCase().includes('INBOX'))) criticalFolders.unshift('INBOX');

                // Executa o sync
                for (const folder of criticalFolders) {
                    const res = await syncFolder(connection, config.id, folder, supabase);
                    if (res.new) stats.totalNew += res.new;
                    if (res.pending) stats.totalPending += res.pending;
                }

            } catch (err) {
                console.error(`Erro conta ${config.email}:`, err);
            } finally {
                if (connection) connection.end();
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Sincronizados: ${stats.totalNew}. Pendentes na fila: ${stats.totalPending}`,
            ...stats 
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Suporte a GET também para facilitar testes manuais
export async function GET(req) { return POST(req); }