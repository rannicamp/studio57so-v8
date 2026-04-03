import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const payload = await req.json();
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const {
      mensagem,
      detalhes,
      url,
      browser,
      userAgent,
      userId,
      orgId
    } = payload;

    // Constrói o log
    const infoComposta = `Browser: ${browser} | UA: ${userAgent}`;

    const { error } = await supabase
      .from('logs_erros_ui')
      .insert([
        {
          mensagem: mensagem || 'Erro desconhecido',
          detalhes: detalhes || null,
          url_atual: url || 'unknown',
          browser_info: infoComposta,
          usuario_id: userId || null,
          organizacao_id: orgId || null
        }
      ]);

    if(error){
      console.error('[Telemetry] Falha ao salvar log de erro no Supabase:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    console.error('[Telemetry] Falha fatal no endpoint:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
