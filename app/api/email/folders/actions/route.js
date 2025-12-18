import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

export async function POST(request) {
    const supabase = createClient();
    
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
                // Proteção: Não deletar pastas do sistema
                const forbidden = ['INBOX', 'ENTRADA', 'TRASH', 'LIXEIRA', 'SENT', 'ENVIADOS', 'JUNK', 'SPAM'];
                if (forbidden.some(f => folderPath.toUpperCase().includes(f))) {
                    throw new Error('Não é possível excluir pastas do sistema.');
                }
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
                    // Tenta remover permanentemente (Expunge)
                    // Nota: Alguns servidores fazem auto-expunge ao fechar
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
            return NextResponse.json({ error: opError.message }, { status: 500 });
        } finally {
            connection.end();
        }

    } catch (error) {
        console.error('Erro geral folder actions:', error);
        return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
    }
}