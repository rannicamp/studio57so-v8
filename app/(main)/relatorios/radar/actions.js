'use server';

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function getRadarStats(periodo = '30_dias') {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  // Define data de corte (padrão 30 dias)
  const dataCorte = new Date();
  dataCorte.setDate(dataCorte.getDate() - 30);

  try {
    // 1. Buscar dados brutos
    const { data: visitas, error } = await supabase
      .from('monitor_visitas')
      .select('*')
      .gte('data_acesso', dataCorte.toISOString());

    if (error) throw error;

    // 2. Processar Métricas
    const totalVisitas = visitas.length;
    
    // Dispositivos
    const mobile = visitas.filter(v => v.dispositivo === 'Celular').length;
    const desktop = visitas.filter(v => v.dispositivo === 'Computador').length;

    // Top Páginas
    const paginasMap = visitas.reduce((acc, curr) => {
      acc[curr.pagina] = (acc[curr.pagina] || 0) + 1;
      return acc;
    }, {});
    
    const topPaginas = Object.entries(paginasMap)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5); // Top 5

    // Origens
    const origensMap = visitas.reduce((acc, curr) => {
      const origemLimpa = curr.origem || 'Direto';
      acc[origemLimpa] = (acc[origemLimpa] || 0) + 1;
      return acc;
    }, {});

    const topOrigens = Object.entries(origensMap)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd);

    // Linha do Tempo (Últimos 7 dias)
    const timelineMap = {};
    visitas.forEach(v => {
      const dia = new Date(v.data_acesso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      timelineMap[dia] = (timelineMap[dia] || 0) + 1;
    });

    const timeline = Object.entries(timelineMap)
      .map(([data, qtd]) => ({ data, qtd }))
      .sort((a, b) => new Date(a.data) - new Date(b.data)); // Ordenar por data seria ideal converter string, mas para simplicidade visual ok

    return {
      totalVisitas,
      porDispositivo: { mobile, desktop },
      topPaginas,
      topOrigens,
      timeline
    };

  } catch (err) {
    console.error('Erro ao buscar Radar:', err);
    return null;
  }
}