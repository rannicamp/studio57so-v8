// Caminho: app/_actions/monitorActions.js
'use server';

import { createClient } from '@/utils/supabase/client'; // Ou seu caminho de server client

export async function registrarVisita(dados) {
  const supabase = createClient();

  try {
    // Tenta pegar o usuário se estiver logado (opcional)
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('monitor_visitas')
      .insert({
        pagina: dados.pagina,
        origem: dados.origem || 'Direto',
        dispositivo: dados.dispositivo,
        visitante_id: user ? user.id : null // Se tiver logado, salva o ID
      });

    if (error) {
      console.error('Erro no Monitor de Visitas:', error);
    }
  } catch (err) {
    console.error('Erro fatal no Monitor:', err);
  }
}