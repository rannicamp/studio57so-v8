// rannicamp/teste-netlify/teste-netlify-1f74408eafb3943aeb9eb92a02aecae60eaac333/app/rdo/page.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client'; // Caminho corrigido
import RdoForm from '../../components/RdoForm'; // Caminho corrigido

export default function RdoPage() {
  const supabase = createClient();
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchInitialData = useCallback(async () => {
    try {
      const { data: empreendimentosData, error } = await supabase.from('empreendimentos').select('id, nome, address_street, address_number, address_complement, neighborhood, city, state').order('nome');
      if (error) {
        console.error("Erro ao buscar empreendimentos:", error);
      }
      setEmpreendimentos(empreendimentosData || []);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleEmpreendimentoChange = (e) => {
    const empreendimentoId = e.target.value;
    if (empreendimentoId) {
        const selected = empreendimentos.find(emp => emp.id.toString() === empreendimentoId);
        setSelectedEmpreendimento(selected);
    } else {
        setSelectedEmpreendimento(null);
    }
  };

  if (loading) {
    return <p className="text-center mt-10">Carregando dados...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h1 className="text-3xl font-bold text-gray-900">Relatório Diário de Obra (RDO)</h1>
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
        <RdoForm selectedEmpreendimento={selectedEmpreendimento} />
      ) : (
        <p className="p-4 text-gray-500">Selecione um empreendimento para preencher o RDO.</p>
      )}
    </div>
  );
}