// Caminho: app/(landingpages)/radar/actions.js
'use server';

import { createClient } from '@/utils/supabase/server';

export async function buscarDadosDoRadar() {
  const supabase = await createClient();

  try {
    // Chama a nossa função SQL (RPC) diretamente
    const { data, error } = await supabase.rpc('get_radar_stats', { dias: 30 });

    if (error) throw error;

    return data; // O JSON já vem pronto do banco! 🚀
  } catch (err) {
    console.error('Erro ao buscar radar via RPC:', err);
    return null;
  }
}