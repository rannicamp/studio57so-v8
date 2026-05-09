import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { upsertEvent, getOAuth2Client, getTokensFromCode } from '@/lib/googleCalendar';

export async function POST(request) {
  try {
    const { activity } = await request.json();

    if (!activity || !activity.id) {
      return NextResponse.json({ error: 'Atividade inválida' }, { status: 400 });
    }

    const organizacao_id = activity.organizacao_id;
    const responsavel_id = activity.funcionario_id; 

    // Usaremos o adminClient para ler todas as integrações da organização (Global) e a do Responsável (Minhas)
    const supabase = createAdminClient();

    // 1. Buscamos todas as integrações ativas desta organização
    const { data: integracoes, error } = await supabase
      .from('integracoes_google')
      .select('*')
      .eq('organizacao_id', organizacao_id)
      .eq('is_active', true);

    if (error || !integracoes || integracoes.length === 0) {
      // Nenhuma integração ativa na org, não fazemos nada. Sucesso silencioso.
      return NextResponse.json({ success: true, message: 'Nenhuma integração ativa.' });
    }

    const promises = integracoes.map(async (integracao) => {
      try {
        const {
          access_token,
          refresh_token,
          user_id,
          global_calendar_id,
          minhas_atividades_calendar_id
        } = integracao;

        // Se a integração não tiver tokens, ignora
        if (!access_token || !refresh_token) return null;

        const summary = activity.nome || 'Sem Título';
        const description = `${activity.descricao || ''}\n\nLink: ${process.env.NEXT_PUBLIC_URL}/atividades?id=${activity.id}`;
        
        let startObj = {};
        let endObj = {};
        const pad = (n) => n.toString().padStart(2, '0');

        // 1. Início
        if (activity.data_inicio_prevista) {
          if (activity.hora_inicio) {
            // Garantir que a hora está no formato HH:MM (removendo segundos se o banco mandar)
            const timePart = activity.hora_inicio.substring(0, 5); 
            // Evento com hora específica
            startObj = {
              dateTime: `${activity.data_inicio_prevista}T${timePart}:00`,
              timeZone: 'America/Sao_Paulo'
            };
          } else {
            // Dia inteiro
            startObj = { date: activity.data_inicio_prevista };
          }
        } else {
          startObj = { dateTime: activity.created_at };
        }

        // 2. Fim
        const baseEndDateStr = activity.data_fim_prevista || activity.data_inicio_prevista;
        if (baseEndDateStr) {
          if (activity.hora_inicio) {
            const timePart = activity.hora_inicio.substring(0, 5);
            // Multiplicamos por 60 para lidar com horas fracionadas (ex: 1.5 horas = 90 min)
            const duracaoMinutos = (Number(activity.duracao_horas) || 1) * 60;
            const endDate = new Date(`${baseEndDateStr}T${timePart}:00`);
            endDate.setMinutes(endDate.getMinutes() + duracaoMinutos);
            
            const endDateTimeStr = `${endDate.getFullYear()}-${pad(endDate.getMonth()+1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;
            endObj = {
              dateTime: endDateTimeStr,
              timeZone: 'America/Sao_Paulo'
            };
          } else {
            // Dia inteiro. Google exige que data fim seja EXCLUSIVA (+1 dia)
            const nextDay = new Date(baseEndDateStr + 'T00:00:00');
            nextDay.setDate(nextDay.getDate() + 1);
            endObj = {
              date: `${nextDay.getFullYear()}-${pad(nextDay.getMonth()+1)}-${pad(nextDay.getDate())}`
            };
          }
        } else {
          endObj = { dateTime: activity.created_at };
        }

        const syncPromises = [];

        // 2. Envia para a Visão Global (de TODO MUNDO que tem token na empresa)
        if (global_calendar_id) {
          syncPromises.push(
            upsertEvent({
              accessToken: access_token,
              refreshToken: refresh_token,
              calendarId: global_calendar_id,
              eventId: `elo57global${String(activity.id).replace(/-/g, '')}`, // Formato válido pro Google (sem traços)
              summary,
              description,
              start: startObj,
              end: endObj
            })
          );
        }

        // 3. Envia para "Minhas Atividades" APENAS SE este usuário da integração for o responsável pela atividade
        // (No Elo 57, funcionario_id é FK pra funcionarios, mas user_id na integração é o auth.users.id.
        // Precisamos verificar se o auth.users vinculado ao funcionário é o mesmo da integração).
        // Para simplificar, faremos uma checagem rápida no DB se o funcionario_id bate com o user_id (se tiver email igual ou vínculo).
        // Se a empresa ainda não tiver vínculo forte Funcionario <-> User_id, vamos assumir que o "criado_por_usuario_id" ou uma rotina posterior resolve.
        // Para garantir, vamos checar se o funcionario_id desta atividade pertence ao user_id desta integração.
        
        let isResponsavel = false;
        if (responsavel_id) {
          const { data: funcData } = await supabase
            .from('funcionarios')
            .select('user_id')
            .eq('id', responsavel_id)
            .single();
          
          if (funcData?.user_id === user_id) {
            isResponsavel = true;
          }
        }

        if (isResponsavel && minhas_atividades_calendar_id) {
           syncPromises.push(
            upsertEvent({
              accessToken: access_token,
              refreshToken: refresh_token,
              calendarId: minhas_atividades_calendar_id,
              eventId: `elo57minhas${String(activity.id).replace(/-/g, '')}`, 
              summary,
              description,
              start: startObj,
              end: endObj
            })
          );
        }

        await Promise.all(syncPromises);

      } catch (err) {
        console.error(`Erro ao sincronizar atividade ${activity.id} para integração ${integracao.id}:`, err);
        // Falha isolada de uma integração não deve quebrar o loop
      }
    });

    await Promise.all(promises);

    return NextResponse.json({ success: true, message: 'Sincronização processada em background.' });

  } catch (error) {
    console.error('Erro crítico no endpoint de sync do Google Calendar:', error);
    return NextResponse.json({ error: 'Erro interno ao sincronizar' }, { status: 500 });
  }
}
