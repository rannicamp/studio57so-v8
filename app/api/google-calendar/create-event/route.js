import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { google } from 'googleapis';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function POST(request) {
  // Pega a sessão do usuário para obter o token de acesso
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Não autorizado. Faça o login com o Google.' }, { status: 401 });
  }

  try {
    const { nome, descricao, data_inicio_prevista, data_fim_prevista } = await request.json();

    if (!nome || !data_inicio_prevista || !data_fim_prevista) {
      return NextResponse.json({ error: 'Dados da atividade incompletos.' }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: session.accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: `[SISTEMA] ${nome}`,
      description: descricao || 'Nenhuma descrição fornecida.',
      start: {
        date: data_inicio_prevista,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        date: data_fim_prevista,
        timeZone: 'America/Sao_Paulo',
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary', // 'primary' refere-se à agenda principal do usuário
      resource: event,
    });

    return NextResponse.json({ message: 'Evento criado com sucesso!', data: response.data });

  } catch (error) {
    console.error('Erro ao criar evento no Google Calendar:', error);
    return NextResponse.json({ error: 'Falha ao criar evento no Google Calendar.' }, { status: 500 });
  }
}