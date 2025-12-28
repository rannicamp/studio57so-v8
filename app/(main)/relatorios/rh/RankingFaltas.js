"use client";

import { useQuery } from '@tanstack/react-query';
import { faUserSlash } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import RankingWidget from './RankingWidget';

// Função que chama a calculadora específica de Faltas no Banco
async function fetchFaltas(organizacao_id, dateRef) {
  if (!organizacao_id) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc('calcular_ranking_faltas', { 
    p_organizacao_id: organizacao_id, 
    p_mes_ref: dateRef ? dateRef.slice(0, 7) : null
  });
  if (error) throw new Error(error.message);
  return data || [];
}

export default function RankingFaltas({ mesRef }) {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['rhRankingFaltas', user?.organizacao_id, mesRef],
    queryFn: () => fetchFaltas(user?.organizacao_id, mesRef),
    enabled: !!user?.organizacao_id,
    staleTime: 1000 * 60 * 5,
  });

  const getPeriodoTexto = () => {
    if (!mesRef) return '';
    const [ano, mes] = mesRef.split('-'); 
    const ultimoDia = new Date(ano, mes, 0).getDate();
    return `01/${mes}/${ano} a ${ultimoDia}/${mes}/${ano}`;
  };

  return (
    <RankingWidget 
      title="Mais Faltas"
      icon={faUserSlash}
      color="red"
      labelUnit="faltas"
      data={data}
      periodoTexto={getPeriodoTexto()}
      isLoading={isLoading}
      isError={isError}
    />
  );
}