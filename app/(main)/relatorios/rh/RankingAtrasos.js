"use client";

import { useQuery } from '@tanstack/react-query';
import { faUserClock } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import RankingWidget from './RankingWidget';

// Função que chama a calculadora específica de Atrasos no Banco
async function fetchAtrasos(organizacao_id, dateRef) {
  if (!organizacao_id) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc('calcular_ranking_atrasos', { 
    p_organizacao_id: organizacao_id, 
    p_mes_ref: dateRef ? dateRef.slice(0, 7) : null
  });
  if (error) throw new Error(error.message);
  return data || [];
}

export default function RankingAtrasos({ mesRef }) {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['rhRankingAtrasos', user?.organizacao_id, mesRef],
    queryFn: () => fetchAtrasos(user?.organizacao_id, mesRef),
    enabled: !!user?.organizacao_id,
    staleTime: 1000 * 60 * 5, // Cache de 5 min
  });

  // Auxiliar para texto do período
  const getPeriodoTexto = () => {
    if (!mesRef) return '';
    const [ano, mes] = mesRef.split('-'); 
    const ultimoDia = new Date(ano, mes, 0).getDate();
    return `01/${mes}/${ano} a ${ultimoDia}/${mes}/${ano}`;
  };

  return (
    <RankingWidget 
      title="Mais Atrasos"
      icon={faUserClock}
      color="orange"
      labelUnit="atrasos"
      data={data}
      periodoTexto={getPeriodoTexto()}
      isLoading={isLoading}
      isError={isError}
    />
  );
}