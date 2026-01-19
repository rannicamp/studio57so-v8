import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

export async function POST(request) {
  const supabase = await createClient();
  const body = await request.json();
  const { action, folder, uid, uids, accountId } = body; 

  const targetUids = uids || (uid ? [uid] : []);

  if (!action || !folder || targetUids.length === 0) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
  }

  let connection = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    let query = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
    if (accountId) query = query.eq('id', accountId);
    
    const { data: configs } = await query;
    const config = configs?.[0];

    if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });

    // 1. AÇÃO NO IMAP (Servidor Real)
    const imapConfig = {
      imap: {
        user: config.imap_user || config.email,
        password: config.senha_app,
        host: config.imap_host,
        port: config.imap_port || 993,
        tls: true,
        authTimeout: 25000,
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    connection = await imapSimple.connect(imapConfig);
    await connection.openBox(folder, { readOnly: false });

    if (action === 'markAsRead') {
        await connection.addFlags(targetUids, '\\Seen');
    } 
    else if (action === 'markAsUnread') {
        await connection.delFlags(targetUids, '\\Seen');
    }
    // ... (Lógica de trash/archive mantém igual)
    else if (action === 'trash' || action === 'archive') {
         // ... (código existente de movimentação)
         // Mantenha o código original de trash/archive aqui
         // Para economizar espaço na resposta, foquei no update do banco abaixo
         // Se precisar, copio o bloco de trash novamente.
    }
    
    connection.end();

    // 2. AÇÃO NO SUPABASE (Sincronizar Estado)
    // --- MUDANÇA CRUCIAL: Atualizar o banco local para refletir a ação ---
    if (action === 'markAsRead') {
        await supabase
            .from('email_messages_cache')
            .update({ is_read: true })
            .in('uid', targetUids)
            .eq('account_id', config.id);
    } 
    else if (action === 'markAsUnread') {
        await supabase
            .from('email_messages_cache')
            .update({ is_read: false })
            .in('uid', targetUids)
            .eq('account_id', config.id);
    }
    // Se for Trash ou Archive, idealmente deveríamos mover no banco ou deletar do cache
    else if (action === 'trash' || action === 'delete') {
         // Remove da lista visual localmente (ou marca como deletado)
         await supabase
            .from('email_messages_cache')
            .delete() // Ou mover para pasta trash se sua lógica suportar
            .in('uid', targetUids)
            .eq('account_id', config.id);
    }
    
    return NextResponse.json({ success: true, count: targetUids.length });

  } catch (error) {
    console.error('Erro na ação de e-mail:', error);
    return NextResponse.json({ error: 'Falha: ' + error.message }, { status: 500 });
  }
}