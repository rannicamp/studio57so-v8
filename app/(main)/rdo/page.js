"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import RdoForm from '../../../components/rdo/RdoForm';
import Link from 'next/link';

export default function RdoPage() {
  const supabase =createClient();
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState(null);
  const [loading, setLoading] = useState(true);

  // Busca a lista de empreendimentos para o usuário selecionar
  const fetchEmpreendimentos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome')
        .order('nome');

      if (error) {
        console.error("Erro ao buscar empreendimentos:", error);
      } else {
        setEmpreendimentos(data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchEmpreendimentos();
  }, [fetchEmpreendimentos]);

  const handleEmpreendimentoChange = (e) => {
    const empreendimentoId = e.target.value;
    const selected = empreendimentos.find(emp => emp.id.toString() === empreendimentoId);
    setSelectedEmpreendimento(selected || null);
  };

  if (loading) {
    return <p className="text-center mt-10">Carregando dados...</p>;
  }
  
  // Esta página agora serve para criar um NOVO RDO para o dia atual.
  // A edição de RDOs antigos é feita pela página de gerenciamento.
  return (
    <div className="space-y-6">
      <Link href="/rdo/gerenciador" className="text-blue-500 hover:underline mb-4 inline-block">
          &larr; Voltar para o Gerenciador
      </Link>
      <div className="bg-white p-4 rounded-lg shadow">
        <h1 className="text-3xl font-bold text-gray-900">Criar Novo Relatório Diário de Obra (RDO)</h1>
        <p className="text-sm text-gray-600 mt-1">O RDO será criado para a data de hoje.</p>
        <div className="mt-4 flex items-end gap-4">
          <div className="flex-1">
            <label htmlFor="empreendimento-select" className="block text-sm font-medium text-gray-700">Selecione um Empreendimento</label>
            <select id="empreendimento-select" onChange={handleEmpreendimentoChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
              <option value="">-- Escolha um empreendimento --</option>
              {empreendimentos.map((emp) => (<option key={emp.id} value={emp.id}>{emp.nome}</option>))}
            </select>
          </div>
        </div>
      </div>

      {selectedEmpreendimento ? (
        // O formulário irá carregar o RDO de HOJE para este empreendimento, ou criar um novo se não existir.
        <RdoForm selectedEmpreendimento={selectedEmpreendimento} />
      ) : (
        <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
            <p>Selecione um empreendimento acima para iniciar um novo RDO.</p>
        </div>
      )}
    </div>
  );
}