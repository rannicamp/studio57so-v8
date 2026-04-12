import { createClient } from '@/utils/supabase/server';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const dados = await request.json();
    if (!dados.session_id) {
      return NextResponse.json({ error: 'Nenhum sessionId informado' }, { status: 400 });
    }

    const { session_id, url_completa, tempo_permanencia_segundos } = dados;

    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    // Se houver tempo de permanência, vamos atualizar a linha mais recente desse sessionId nessa página
    if (tempo_permanencia_segundos && tempo_permanencia_segundos > 0) {
       // Pegar a visita mais recente desse session_id nessa URL
       const { data: visitaRecente } = await supabase
         .from('monitor_visitas')
         .select('id')
         .eq('session_id', session_id)
         .eq('url_completa', url_completa)
         .order('created_at', { ascending: false })
         .limit(1)
         .single();

       if (visitaRecente) {
          // Atualiza o tempo com base no maior valor reportado (já que o heartbeat/beacon enviará sempre o total contado)
          await supabase
            .from('monitor_visitas')
            .update({ tempo_permanencia_segundos: tempo_permanencia_segundos })
            .eq('id', visitaRecente.id);
       }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('❌ Erro no Tracker API:', err);
    return NextResponse.json({ error: 'Erro intero do Tracker' }, { status: 500 });
  }
}
