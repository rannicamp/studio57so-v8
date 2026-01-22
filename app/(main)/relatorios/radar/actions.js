'use server';

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function getRadarStats(periodo = 30) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  try {
    // Chama a função RPC (Remote Procedure Call) que criamos no banco
    const { data, error } = await supabase
      .rpc('get_radar_stats', { dias_atras: periodo });

    if (error) {
      console.error('Erro no RPC Radar:', error);
      throw error;
    }

    // O banco já retorna o JSON prontinho na estrutura que a página espera
    return data;

  } catch (err) {
    console.error('Erro fatal ao buscar estatísticas:', err);
    return null;
  }
}