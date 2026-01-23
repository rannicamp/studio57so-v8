// Caminho: relatorios/radar/actions.js
'use server';

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function getRadarStats(periodo = 30) {
  try {
    // 1. Correção Next.js 15: cookies() agora é uma promessa e precisa de await
    const cookieStore = await cookies();

    // 2. Correção do Erro Fatal: O createClient também retorna uma promessa!
    // Sem o 'await' aqui, a variável 'supabase' vira uma Promessa pendente,
    // e promessas não têm a função .rpc(). Por isso dava o erro.
    const supabase = await createClient(cookieStore);

    // Agora sim, 'supabase' é o cliente real e tem o método .rpc
    const { data, error } = await supabase
      .rpc('get_radar_stats', { dias_atras: periodo });

    if (error) {
      console.error('❌ Erro no RPC Radar (Supabase):', error.message);
      return null; 
    }

    return data;

  } catch (err) {
    console.error('❌ Erro fatal ao buscar estatísticas (Actions):', err);
    return null;
  }
}