const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { upsertEvent } = require('./lib/googleCalendar.js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: integracoes } = await supabase.from('integracoes_google').select('*');
  const integracao = integracoes[0];

  const { data: activities } = await supabase.from('activities').select('*').ilike('nome', '%google agenda%').limit(1);
  const activity = activities[0];
  
  if (!activity) return console.log('Atividade não encontrada');

  const summary = `[Elo 57] ${activity.nome || 'Sem Título'}`;
  const description = `${activity.descricao || ''}\n\nLink: ${process.env.NEXT_PUBLIC_URL}/atividades?id=${activity.id}`;
  const startDateTime = activity.data_inicio_prevista || activity.created_at;
  const endDateTime = activity.data_fim_prevista || activity.data_inicio_prevista || activity.created_at;
  
  console.log('Dados do evento:', { startDateTime, endDateTime });

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
      console.log('Sucesso Google:', res.id);
  } catch (err) {
      console.error('Erro Google:', err);
  }
}
check();
