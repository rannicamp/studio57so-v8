import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

export async function POST(request) {
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { action, folderPath, accountId } = body;

        if (!action || !folderPath) {
            return NextResponse.json({ error: 'Ação e pasta são obrigatórios' }, { status: 400 });
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        // 1. Busca a conta correta
        let query = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
        if (accountId) query = query.eq('id', accountId);

        const { data: configs } = await query;
        const config = configs?.[0];

        if (!config) return NextResponse.json({ error: 'Conta de e-mail não encontrada' }, { status: 404 });

        // 2. Conecta no IMAP dessa conta
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

        const connection = await imapSimple.connect(imapConfig);

        try {
            if (action === 'delete') {
                const pathUpper = folderPath.toUpperCase();
                const forbiddenExact = [
                    'INBOX', 'CAIXA DE ENTRADA', 'ENTRADA',
                    'TRASH', 'LIXEIRA', 'ITENS EXCLUIDOS', 'BIN', 'DELETED',
                    'SENT', 'ENVIADOS', 'ITENS ENVIADOS',
                    'JUNK', 'SPAM', 'LIXO ELETRONICO', 'QUARANTINE',
                    'DRAFTS', 'RASCUNHOS'
                ];

                if (forbiddenExact.includes(pathUpper)) {
                    throw new Error(`A pasta "${folderPath}" é protegida pelo sistema.`);
                }

                await connection.delBox(folderPath);

                // Excluir também do cache local para não perder sincronia
                await supabase.from('email_messages_cache')
                    .delete()
                    .eq('account_id', config.id)
                    .eq('folder_path', folderPath);
            }
            else if (action === 'empty') {
                await connection.openBox(folderPath, { readOnly: false });
                
                // Pega todos os UIDs da pasta
                const messages = await connection.search(['ALL'], { bodies: ['HEADER.FIELDS (MESSAGE-ID)'], markSeen: false });
                
                if (messages.length > 0) {
                    const uids = messages.map(m => m.attributes.uid);
                    
                    const isTrashFolder = folderPath.toUpperCase().includes('TRASH') || 
                                          folderPath.toUpperCase().includes('LIXEIRA') || 
                                          folderPath.toUpperCase().includes('DELETED');

                    if (!isTrashFolder) {
                        // Se não for a lixeira, "Esvaziar" a pasta significa mover tudo para a Lixeira
                        try {
                            // Tenta mover para a TRASH padrão em muitos hosts
                            await connection.moveMessage(uids, 'INBOX.Trash');
                        } catch(e) {
                            try { await connection.moveMessage(uids, 'TRASH'); } catch(err2) {
                                // Se o host nao tiver Trash comum, só marca como deletado e foda-se
                                await connection.addFlags(uids, '\\Deleted');
                            }
                        }
                        
                        // Atualiza o cache local para refletir a ida para a lixeira
                        await supabase.from('email_messages_cache')
                            .update({ folder_path: 'INBOX.Trash' })
                            .eq('account_id', config.id)
                            .eq('folder_path', folderPath)
                            .in('uid', uids);
                    } else {
                        // Se JÁ ESTIVER NA LIXEIRA, "Esvaziar" significa ANQUILAÇÃO TOTAL (Hard Delete)
                        await connection.addFlags(uids, '\\Deleted');
                        
                        try { 
                            // Expunge deleta DEFINITIVAMENTE mensagens com a flag \Deleted
                            await connection.imap.expunge(uids); 
                        } catch (e) {
                            console.log("Erro no expunge manual, dependendo do auto-expunge do servidor");
                        }

                        // Remove fisicamente as mensagens do nosso banco de cache
                        await supabase.from('email_messages_cache')
                            .delete()
                            .eq('account_id', config.id)
                            .eq('folder_path', folderPath)
                            .in('uid', uids);
                    }
                }
                await connection.closeBox();
            }
            else if (action === 'markAllRead') {
                // ESTRATÉGIA OFFLINE-FIRST NATIVA
                // 1. Atualizar o Supabase IMEADIATAMENTE (isso zera o contador na tela no mesmo milissegundo)
                await supabase.from('email_messages_cache')
                    .update({ is_read: true })
                    .eq('account_id', config.id)
                    .eq('folder_path', folderPath)
                    .eq('is_read', false);

                // 2. Disparar o comando para o provedor de Email em Lote Rápido
                // Sem pedir cabeçalhos de volta (que é o que causa o grande gargalo de Timeout)
                await connection.openBox(folderPath);

                // Pega apenas as numerações exatas rapidinho
                const results = await connection.search(['UNSEEN'], { markSeen: true });
                // Ao passar markSeen: true, o próprio comando de busca já diz pro servidor mudar a flag lá.
                // Não precisa rodar addFlags() manualmente depois de baixar uma lista gigante.

                await connection.closeBox();
            } else {
                throw new Error('Ação inválida');
            }

            return NextResponse.json({ success: true });

        } catch (opError) {
            console.error(`Erro na operação ${action}:`, opError);
            // Melhora a mensagem de erro para o usuário
            const msg = opError.message.includes('NONEXISTENT') ? 'Pasta não encontrada.' :
                opError.message.includes('CANNOT') ? 'O servidor bloqueou essa ação.' :
                    opError.message;
            return NextResponse.json({ error: msg }, { status: 500 });
        } finally {
            connection.end();
        }

    } catch (error) {
        console.error('Erro geral folder actions:', error);
        return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
    }
}