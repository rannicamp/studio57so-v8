// Caminho: app/_actions/monitorActions.js
'use server';

import { createClient } from '@/utils/supabase/client'; 

export async function registrarVisita(dados) {
  const supabase = createClient();

  try {
    // Tenta identificar o usuário logado com segurança
    // Nota: Em Server Actions, o ideal é usar createServerClient se disponível,
    // mas vamos manter o padrão atual para evitar erros de importação agora.
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('monitor_visitas')
      .insert({
        pagina: dados.pagina,
        origem: dados.origem || 'Indefinido',
        dispositivo: dados.dispositivo,
        visitante_id: user ? user.id : null, // ID do Auth (se logado)
        session_id: dados.session_id,        // ID da Sessão (Navegador)
        utm_medium: dados.utm_medium,
        utm_campaign: dados.utm_campaign,
        utm_content: dados.utm_content,
        url_completa: dados.url_completa
      });

    if (error) {
      console.error('❌ Erro no Radar (Supabase):', error.message);
    } else {
      // Sucesso silencioso
    }
  } catch (err) {
    console.error('❌ Erro Fatal no Radar:', err);
  }
}