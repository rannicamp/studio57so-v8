'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

const OrcamentoManager = () => {
  // Estados para controlar os dados, carregamento e erros
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [orcamentos, setOrcamentos] = useState([]);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState('');
  const [loadingEmpreendimentos, setLoadingEmpreendimentos] = useState(true);
  const [loadingOrcamentos, setLoadingOrcamentos] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  // Efeito para buscar a lista de empreendimentos quando o componente carregar
  useEffect(() => {
    const fetchEmpreendimentos = async () => {
      setLoadingEmpreendimentos(true);
      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) {
        console.error('Erro ao buscar empreendimentos:', error);
        setError('Não foi possível carregar a lista de empreendimentos.');
      } else {
        setEmpreendimentos(data);
      }
      setLoadingEmpreendimentos(false);
    };

    fetchEmpreendimentos();
  }, []);

  // Efeito para buscar os orçamentos sempre que um empreendimento for selecionado
  useEffect(() => {
    if (!selectedEmpreendimento) {
      setOrcamentos([]);
      return;
    }

    const fetchOrcamentos = async () => {
      setLoadingOrcamentos(true);
      const { data, error } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('empreendimento_id', selectedEmpreendimento)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar orçamentos:', error);
        setError('Não foi possível carregar os orçamentos para este empreendimento.');
      } else {
        setOrcamentos(data);
      }
      setLoadingOrcamentos(false);
    };

    fetchOrcamentos();
  }, [selectedEmpreendimento]);

  // Se ainda estiver carregando a lista principal, exibe uma mensagem
  if (loadingEmpreendimentos) {
    return <p className="text-center text-gray-500">Carregando empreendimentos...</p>;
  }

  // Se deu algum erro na busca principal, exibe o erro
  if (error && !empreendimentos.length) {
    return <p className="text-center text-red-500">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="empreendimento-select" className="block text-sm font-medium text-gray-700 mb-1">
          Selecione o Empreendimento
        </label>
        <select
          id="empreendimento-select"
          value={selectedEmpreendimento}
          onChange={(e) => setSelectedEmpreendimento(e.target.value)}
          className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- Todos os Empreendimentos --</option>
          {/* O map agora é seguro, pois `empreendimentos` começa como um array vazio */}
          {empreendimentos.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.nome}</option>
          ))}
        </select>
      </div>

      <div className="border-t pt-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Orçamentos</h2>
        {loadingOrcamentos ? (
          <p className="text-center text-gray-500">Carregando orçamentos...</p>
        ) : orcamentos.length > 0 ? (
          <ul className="space-y-3">
            {orcamentos.map(orc => (
              <li key={orc.id} className="bg-gray-50 p-4 rounded-lg shadow-sm flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900">{orc.nome_orcamento}</p>
                  <p className="text-sm text-gray-600">Versão: {orc.versao}</p>
                  <p className="text-sm text-gray-600">Status: {orc.status}</p>
                </div>
                <div className="text-right">
                    <p className="font-semibold text-lg text-blue-600">
                        R$ {Number(orc.custo_total_previsto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-500">
            {selectedEmpreendimento ? "Nenhum orçamento encontrado para este empreendimento." : "Selecione um empreendimento para ver os orçamentos."}
          </p>
        )}
      </div>
    </div>
  );
};

export default OrcamentoManager;