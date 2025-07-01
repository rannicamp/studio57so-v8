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
    
    // ***** INÍCIO DA CORREÇÃO *****
    // Agora, também buscamos o 'empresa_proprietaria_id' para fazer a ligação.
    const { data, error } = await supabase
      .from('empreendimentos')
      .select('id, nome, empresa_proprietaria_id') // Campo adicionado aqui
      .order('nome');
    // ***** FIM DA CORREÇÃO *****
    
    if (error) {
      console.error("Erro ao buscar empreendimentos:", error);
      setLoading(false);
      return;
    } 
    
    setEmpreendimentos(data || []);
    const lastSelectedId = localStorage.getItem('selectedEmpreendimentoId');

    if (lastSelectedId === 'all') {
      setSelectedEmpreendimento('all');
    } 
    else if (lastSelectedId && data.some(e => e.id.toString() === lastSelectedId)) {
      setSelectedEmpreendimento(lastSelectedId);
    } 
    else {
      setSelectedEmpreendimento('all');
      localStorage.setItem('selectedEmpreendimentoId', 'all');
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchEmpreendimentos();
  }, [fetchEmpreendimentos]);

  const changeEmpreendimento = (empreendimentoId) => {
    setSelectedEmpreendimento(empreendimentoId);
    localStorage.setItem('selectedEmpreendimentoId', empreendimentoId);
    window.location.reload(); 
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