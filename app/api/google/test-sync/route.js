import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { upsertEvent } from '@/lib/googleCalendar';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // 1. Pega a última integração
    const { data: integracoes } = await supabase.from('integracoes_google').select('*').order('created_at', { ascending: false }).limit(1);
    if (!integracoes || integracoes.length === 0) return NextResponse.json({ error: 'Nenhuma integração' });
    const integracao = integracoes[0];

    // 2. Pega a última atividade com "google" no nome
    const { data: activities } = await supabase.from('activities').select('*').ilike('nome', '%google%').order('created_at', { ascending: false }).limit(1);
    if (!activities || activities.length === 0) return NextResponse.json({ error: 'Nenhuma atividade teste' });
    const activity = activities[0];

    const summary = `[Elo 57] ${activity.nome || 'Sem Título'}`;
    const description = `Link: ${process.env.NEXT_PUBLIC_URL}/atividades?id=${activity.id}`;
    const startDateTime = activity.data_inicio_prevista || activity.created_at;
    const endDateTime = activity.data_fim_prevista || activity.data_inicio_prevista || activity.created_at;

    try {
      const res = await upsertEvent({
        accessToken: integracao.access_token,
        refreshToken: integracao.refresh_token,
        calendarId: integracao.global_calendar_id,
        eventId: `elo57global${activity.id.replace(/-/g, '')}`,
        summary,
        description,
        startDateTime,
        endDateTime
      });
      return NextResponse.json({ success: true, eventId: res.id, message: 'Criado com sucesso!' });
    } catch (err) {
      return NextResponse.json({ 
        error: 'Erro no Google API', 
        message: err.message, 
        code: err.code,
        status: err.status,
        stack: err.stack
      });
    }

  } catch (error) {
    return NextResponse.json({ error: 'Erro interno', message: error.message });
  }
}
