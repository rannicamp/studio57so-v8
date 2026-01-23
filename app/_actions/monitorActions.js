// Caminho: app/_actions/monitorActions.js
'use server';

import { createClient } from '@/utils/supabase/client'; 
import { headers } from 'next/headers'; // <--- Importante!

export async function registrarVisita(dados) {
  const supabase = createClient();

  try {
    // 1. Captura o IP do cabeçalho da requisição
    const headersList = await headers();
    
    // O 'x-forwarded-for' pode vir com vários IPs (proxy), pegamos o primeiro
    let ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip');
    
    // Limpeza: Se vier string com vírgula, pega só a primeira parte
    if (ip && ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }
    
    // Se estiver rodando local (localhost), o IP pode vir como '::1'
    if (!ip) ip = 'Localhost/Desconhecido';

    // 2. Tenta identificar o usuário logado
    const { data: { user } } = await supabase.auth.getUser();

    // 3. Salva no banco com o IP
    const { error } = await supabase
      .from('monitor_visitas')
      .insert({
        pagina: dados.pagina,
        origem: dados.origem || 'Indefinido',
        dispositivo: dados.dispositivo,
        visitante_id: user ? user.id : null,
        session_id: dados.session_id,
        utm_medium: dados.utm_medium,
        utm_campaign: dados.utm_campaign,
        utm_content: dados.utm_content,
        url_completa: dados.url_completa,
        ip: ip // <--- Novo dado salvo!
      });

    if (error) {
      console.error('❌ Erro no Radar:', error.message);
    }
  } catch (err) {
    console.error('❌ Erro Fatal no Radar:', err);
  }
}