import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

export async function POST(request) {
  const supabase = createClient();
  const body = await request.json();
  const { action, folder, uid } = body;

  if (!action || !folder || !uid) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
  }

  let connection = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { data: config } = await supabase
      .from('email_configuracoes')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });

    const imapConfig = {
      imap: {
        user: config.imap_user || config.email,
        password: config.senha_app,
        host: config.imap_host,
        port: config.imap_port || 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    connection = await imapSimple.connect(imapConfig);
    // Para ações de escrita, readOnly deve ser false
    await connection.openBox(folder, { readOnly: false });

    if (action === 'markAsRead') {
        await connection.addFlags(uid, '\\Seen');
    } 
    // Futuro: Implementar 'delete' (move to Trash) ou 'archive' aqui
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erro na ação de e-mail:', error);
    return NextResponse.json({ error: 'Falha ao processar ação' }, { status: 500 });
  } finally {
    if (connection) {
        try { connection.end(); } catch (e) {}
    }
  }
}