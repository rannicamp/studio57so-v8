"use client";

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';

const EmpreendimentoContext = createContext();

export function EmpreendimentoProvider({ children }) {
  const supabase = createClient();
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchEmpreendimentos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('empreendimentos').select('id, nome').order('nome');
    if (error) {
      console.error("Erro ao buscar empreendimentos:", error);
    } else {
      setEmpreendimentos(data || []);
      // Tenta recuperar o último empreendimento selecionado da memória do navegador
      const lastSelectedId = localStorage.getItem('selectedEmpreendimentoId');
      if (lastSelectedId && data.some(e => e.id.toString() === lastSelectedId)) {
        setSelectedEmpreendimento(lastSelectedId);
      } else if (data.length > 0) {
        // Se não houver um salvo, seleciona o primeiro da lista
        setSelectedEmpreendimento(data[0].id.toString());
        localStorage.setItem('selectedEmpreendimentoId', data[0].id.toString());
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchEmpreendimentos();
  }, [fetchEmpreendimentos]);

  const changeEmpreendimento = (empreendimentoId) => {
    setSelectedEmpreendimento(empreendimentoId);
    // Salva a seleção na memória do navegador para persistir
    localStorage.setItem('selectedEmpreendimentoId', empreendimentoId);
    window.location.reload(); // Recarrega a página para garantir que todas as partes do sistema atualizem
  };

  const value = {
    empreendimentos,
    selectedEmpreendimento,
    loading,
    changeEmpreendimento
  };

  return (
    <EmpreendimentoContext.Provider value={value}>
      {children}
    </EmpreendimentoContext.Provider>
  );
}

export function useEmpreendimento() {
  return useContext(EmpreendimentoContext);
}