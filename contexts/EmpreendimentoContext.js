// contexts/EmpreendimentoContext.js
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client'; // Importar o cliente Supabase

const EmpreendimentoContext = createContext();

export function EmpreendimentoProvider({ children }) {
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState(null);
  const [empreendimentos, setEmpreendimentos] = useState([]); // Novo estado para a lista de empreendimentos
  const [loading, setLoading] = useState(true); // Novo estado para o carregamento
  const router = useRouter();
  const supabase = createClient(); // Inicializar o cliente Supabase

  useEffect(() => {
    // Carrega o empreendimento selecionado do localStorage ao iniciar
    const storedEmpreendimentoId = localStorage.getItem('selectedEmpreendimentoId');
    if (storedEmpreendimentoId) {
      setSelectedEmpreendimento(parseInt(storedEmpreendimentoId));
    }

    // Função para buscar todos os empreendimentos
    const fetchEmpreendimentos = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('empreendimentos')
        // MODIFICAÇÃO AQUI: Adicionar 'empresa_proprietaria_id'
        .select('id, nome, empresa_proprietaria_id') 
        .order('nome', { ascending: true });

      if (error) {
        console.error('Erro ao buscar empreendimentos:', error.message);
        // Em um ambiente de produção, você pode querer exibir um toast de erro ou outra UI
      } else {
        setEmpreendimentos(data || []);
      }
      setLoading(false);
    };

    fetchEmpreendimentos();
  }, [supabase]); // Dependência do supabase para re-executar se o cliente mudar (raro, mas boa prática)

  const changeEmpreendimento = (empreendimentoId) => {
    setSelectedEmpreendimento(empreendimentoId);
    if (empreendimentoId) {
      localStorage.setItem('selectedEmpreendimentoId', empreendimentoId);
    } else {
      localStorage.removeItem('selectedEmpreendimentoId');
    }
    router.refresh(); // Revalida os dados da lista de empreendimentos
  };

  return (
    <EmpreendimentoContext.Provider value={{ selectedEmpreendimento, changeEmpreendimento, empreendimentos, loading }}>
      {children}
    </EmpreendimentoContext.Provider>
  );
}

export function useEmpreendimento() {
  const context = useContext(EmpreendimentoContext);
  if (context === undefined) {
    throw new Error('useEmpreendimento must be used within an EmpreendimentoProvider');
  }
  return context;
}