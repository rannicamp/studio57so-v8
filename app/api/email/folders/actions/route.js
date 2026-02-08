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
                // --- PROTEÇÃO INTELIGENTE (CORRIGIDA) ---
                // Só bloqueia se o nome for EXATAMENTE igual a uma pasta de sistema.
                // Isso permite pastas como "Entrada de Projetos" ou "Lixeira Temporária".
                const pathUpper = folderPath.toUpperCase();
                
                // Lista exata de nomes proibidos (padrão IMAP e Português)
                const forbiddenExact = [
                    'INBOX', 'CAIXA DE ENTRADA', 'ENTRADA', 
                    'TRASH', 'LIXEIRA', 'ITENS EXCLUIDOS', 'BIN', 'DELETED',
                    'SENT', 'ENVIADOS', 'ITENS ENVIADOS', 
                    'JUNK', 'SPAM', 'LIXO ELETRONICO', 'QUARANTINE',
                    'DRAFTS', 'RASCUNHOS'
                ];

                // Verifica se é exatamente igual OU se é uma subpasta direta do sistema (ex: INBOX/Algo proibido)
                // Mas permite deletar subpastas criadas pelo usuário.
                
                // Na dúvida, vamos confiar mais no servidor, bloqueando apenas o óbvio.
                if (forbiddenExact.includes(pathUpper)) {
                    throw new Error(`A pasta "${folderPath}" é protegida pelo sistema.`);
                }

                // Tenta deletar. Se o servidor do e-mail não deixar (ex: pasta com filhos ou protegida lá), ele vai retornar erro e nós mostramos.
                await connection.delBox(folderPath);
            } 
            else if (action === 'empty') {
                await connection.openBox(folderPath);
                // Busca todas as mensagens
                const messages = await connection.search(['ALL'], { bodies: ['HEADER'], markSeen: false });
                if (messages.length > 0) {
                    const uids = messages.map(m => m.attributes.uid);
                    // Marca como deletado
                    await connection.addFlags(uids, '\\Deleted');
                    try { await connection.imap.expunge(uids); } catch (e) {}
                }
                await connection.closeBox(); 
            } 
            else if (action === 'markAllRead') {
                await connection.openBox(folderPath);
                const messages = await connection.search(['UNSEEN'], { bodies: ['HEADER'], markSeen: false });
                if (messages.length > 0) {
                    const uids = messages.map(m => m.attributes.uid);
                    await connection.addFlags(uids, '\\Seen');
                }
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