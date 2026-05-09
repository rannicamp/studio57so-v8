import { NextResponse } from 'next/server';
import { getTokensFromCode, createCalendar, getOAuth2Client } from '@/lib/googleCalendar';
import { createClient } from '@/utils/supabase/server';
import { google } from 'googleapis';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('Erro retornado pelo Google:', error);
      return NextResponse.redirect(new URL('/configuracoes?google_sync=error', request.url));
    }

    if (!code) {
      return NextResponse.json({ error: 'Código não fornecido' }, { status: 400 });
    }

    // 1. Validar usuário logado no Elo 57
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar a organização_id do usuário (importante para salvar a integração)
    const { data: userData } = await supabase
      .from('usuarios')
      .select('organizacao_id')
      .eq('id', user.id)
      .single();

    const organizacao_id = userData?.organizacao_id;

    if (!organizacao_id) {
       return NextResponse.json({ error: 'Organização não encontrada para o usuário' }, { status: 400 });
    }

    // 2. Trocar o código pelos Tokens
    const tokens = await getTokensFromCode(code);
    const { access_token, refresh_token, expiry_date } = tokens;

    // Se não retornar refresh_token e a gente ainda não tinha um (primeiro login do usuário), 
    // ele pode ter logado recentemente sem dar o prompt. A flag prompt: 'consent' no auth url deve prevenir isso.
    if (!refresh_token) {
        console.warn('O Google não retornou refresh_token. Isso ocorre se o usuário já tiver autorizado antes sem revogar.');
    }

    // Opcional: Buscar o email do Google para salvar e referenciar
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email;

    const state = searchParams.get('state');
    const tipo_conexao = state || 'agenda'; // 'agenda', 'drive', ou 'contatos'

    // 3. Criar as duas Agendas (Calendars) Iniciais SOMENTE se for agenda
    let minhas_atividades_calendar_id = null;
    let global_calendar_id = null;

    if (tipo_conexao === 'agenda') {
      try {
          minhas_atividades_calendar_id = await createCalendar(access_token, refresh_token, 'Elo 57 - Minhas Atividades');
          global_calendar_id = await createCalendar(access_token, refresh_token, 'Elo 57 - Visão Global');
      } catch (calendarError) {
          console.error('Erro ao criar agendas:', calendarError);
      }
    }

    // 4. Salvar tudo no Supabase
    // Vamos buscar se o usuário já tem uma integração DESSE TIPO
    const { data: existingIntegration } = await supabase
      .from('integracoes_google')
      .select('id, refresh_token, minhas_atividades_calendar_id, global_calendar_id')
      .eq('user_id', user.id)
      .eq('tipo_conexao', tipo_conexao)
      .single();

    // Se ele já tinha agendas criadas, mantemos os IDs para não criar duplicado na próxima
    if (existingIntegration?.minhas_atividades_calendar_id && minhas_atividades_calendar_id) {
       minhas_atividades_calendar_id = existingIntegration.minhas_atividades_calendar_id;
    }
    if (existingIntegration?.global_calendar_id && global_calendar_id) {
       global_calendar_id = existingIntegration.global_calendar_id;
    }

    const payload = {
      user_id: user.id,
      organizacao_id: organizacao_id,
      tipo_conexao: tipo_conexao,
      access_token,
      // Só sobrescreve se o google mandou um novo. Se falhar, usa string vazia pra não quebrar o banco
      refresh_token: refresh_token || existingIntegration?.refresh_token || 'missing_refresh_token',
      token_expires_at: new Date(expiry_date).toISOString(),
      minhas_atividades_calendar_id,
      global_calendar_id,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    if (existingIntegration) {
       const { error: updateError } = await supabase.from('integracoes_google').update(payload).eq('id', existingIntegration.id);
       if (updateError) throw new Error('Erro ao atualizar integração: ' + updateError.message);
    } else {
       const { error: insertError } = await supabase.from('integracoes_google').insert([payload]);
       if (insertError) throw new Error('Erro ao inserir integração: ' + insertError.message);
    }

    // Sucesso! Redireciona de volta para as configurações
    return NextResponse.redirect(new URL('/configuracoes/integracoes?google_sync=success', request.url));

  } catch (error) {
    console.error('Erro crítico no callback do Google:', error);
    // Retorna o JSON do erro para a tela, assim podemos ver exatamente onde quebrou!
    return NextResponse.json({ 
        error: 'Erro crítico no callback', 
        message: error.message, 
        stack: error.stack 
    }, { status: 500 });
  }
}
