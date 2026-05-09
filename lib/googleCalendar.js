import { google } from 'googleapis';

/**
 * Retorna uma instância configurada do OAuth2 client
 */
export const getOAuth2Client = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_URL}/api/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Configurações do Google (Client ID / Secret) não encontradas no .env');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

/**
 * Gera a URL para o usuário logar e dar permissão ao Google
 * @param {string} tipo - 'agenda', 'drive' ou 'contatos'
 */
export const getAuthUrl = (tipo = 'agenda') => {
  const oauth2Client = getOAuth2Client();
  
  // Escopos baseiam-se no tipo de conexão
  let scopes = ['https://www.googleapis.com/auth/userinfo.email'];
  
  if (tipo === 'drive') {
    scopes.push('https://www.googleapis.com/auth/drive.file');
  } else if (tipo === 'contatos') {
    scopes.push('https://www.googleapis.com/auth/contacts');
  } else {
    // Default: agenda
    scopes.push('https://www.googleapis.com/auth/calendar');
  }
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Necessário para receber o refresh_token
    prompt: 'consent', // Força exibir a tela de consentimento para garantir o refresh_token
    scope: scopes,
    state: tipo, // Passamos o tipo no estado para recuperar no callback
  });
};

/**
 * Pega o código recebido no callback e troca pelos tokens
 */
export const getTokensFromCode = async (code) => {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

/**
 * Retorna uma instância do serviço Calendar pronta para uso
 */
export const getCalendarService = (accessToken, refreshToken) => {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
};

/**
 * Cria uma nova agenda (Calendar) na conta do Google do usuário
 * @param {string} calendarName - Nome da Agenda (Ex: "Elo 57 - Minhas Atividades")
 * @returns {string} ID da nova agenda
 */
export const createCalendar = async (accessToken, refreshToken, calendarName) => {
  const calendar = getCalendarService(accessToken, refreshToken);
  
  const response = await calendar.calendars.insert({
    requestBody: {
      summary: calendarName,
      timeZone: 'America/Sao_Paulo',
    },
  });

  return response.data.id;
};

/**
 * Cria ou atualiza um evento em uma agenda específica
 */
export const upsertEvent = async ({
  accessToken,
  refreshToken,
  calendarId,
  eventId, // Se passado, tentamos atualizar. Se não, criamos.
  summary,
  description,
  start,
  end,
}) => {
  const calendar = getCalendarService(accessToken, refreshToken);

  const eventBody = {
    summary,
    description,
    start,
    end,
  };

  if (eventId) {
    eventBody.id = eventId;
  }

  try {
    if (eventId) {
      // Tenta atualizar o evento existente
      try {
        const response = await calendar.events.update({
          calendarId,
          eventId,
          requestBody: eventBody,
        });
        return response.data;
      } catch (err) {
        // Se retornar 404, o evento ainda não existe, então criamos (insert)
        if (err.code === 404 || err.status === 404 || err.message.includes('Not Found')) {
          const response = await calendar.events.insert({
            calendarId,
            requestBody: eventBody,
          });
          return response.data;
        }
        throw err; // Se for outro erro, repassa
      }
    } else {
      // Cria novo evento (sem ID customizado)
      const response = await calendar.events.insert({
        calendarId,
        requestBody: eventBody,
      });
      return response.data;
    }
  } catch (error) {
    console.error('Erro ao inserir/atualizar evento no Google Calendar:', error);
    throw error;
  }
};

/**
 * Remove um evento da agenda
 */
export const deleteEvent = async (accessToken, refreshToken, calendarId, eventId) => {
  const calendar = getCalendarService(accessToken, refreshToken);
  
  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    });
    return true;
  } catch (error) {
    console.error('Erro ao deletar evento no Google Calendar:', error);
    return false;
  }
};
