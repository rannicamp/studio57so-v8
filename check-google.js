const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { google } = require('googleapis');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('integracoes_google').select('*').single();
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  
  oauth2Client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  try {
      const response = await calendar.events.insert({
        calendarId: data.global_calendar_id,
        requestBody: {
            summary: "Teste de Evento Manual Node",
            start: { dateTime: new Date().toISOString() },
            end: { dateTime: new Date(Date.now() + 3600000).toISOString() }
        },
      });
      console.log('Criou evento:', response.data.id);
  } catch (err) {
      console.error('Erro ao criar:', err.message);
  }
}
check();
