"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../../utils/supabase/client';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEye, 
  faFileDownload, 
  faEdit, 
  faPlus, 
  faSearch,
  faFilePdf
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function RdoGerenciadorPage() {
  const supabase = createClient();
  const [rdos, setRdos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Busca os RDOs no banco de dados
  const fetchRdos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('diarios_obra')
        .select(`
          *,
          empreendimentos (nome),
          usuarios (nome, sobrenome)
        `)
        .order('data_relatorio', { ascending: false }); // Ordena do mais recente para o mais antigo

      if (error) throw error;
      setRdos(data || []);
    } catch (error) {
      console.error("Erro ao buscar RDOs:", error);
      toast.error("Erro ao carregar a lista de RDOs.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchRdos();
  }, [fetchRdos]);

  // Filtra os RDOs com base na pesquisa
  const filteredRdos = rdos.filter(rdo => {
    const searchLower = searchTerm.toLowerCase();
    const empNome = rdo.empreendimentos?.nome?.toLowerCase() || '';
    const rdoNum = rdo.rdo_numero?.toLowerCase() || '';
    const responsavel = rdo.responsavel_rdo?.toLowerCase() || '';
    
    return empNome.includes(searchLower) || rdoNum.includes(searchLower) || responsavel.includes(searchLower);
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      
      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciador de RDOs</h1>
          <p className="text-gray-500 mt-1">Histórico e controle dos Relatórios Diários de Obra.</p>
        </div>
        <Link 
          href="/rdo" 
          className="bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 flex items-center gap-2 shadow-sm transition-all"
        >
          <FontAwesomeIcon icon={faPlus} />
          Novo RDO
        </Link>
      </div>

      {/* BARRA DE PESQUISA */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar por empreendimento, número ou responsável..."
            className="pl-10 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* TABELA DE LISTAGEM */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-10 text-center text-gray-500">
            <p>Carregando registros...</p>
          </div>
        ) : filteredRdos.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <p>Nenhum RDO encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empreendimento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RDO Nº</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status PDF</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRdos.map((rdo) => {
                  // Formata a data para exibir DD/MM/AAAA corretamente (ignorando fuso)
                  const dataParts = rdo.data_relatorio.split('-');
                  const dataFormatada = `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}`;
                  
                  return (
                    <tr key={rdo.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {dataFormatada}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {rdo.empreendimentos?.nome || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        #{rdo.rdo_numero || 'S/N'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {rdo.pdf_url ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Assinado
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex justify-center items-center gap-3">
                          
                          {/* BOTÕES DE PDF (Só aparecem se o PDF existir) */}
                          {rdo.pdf_url ? (
                            <>
                              {/* Visualizar */}
                              <a 
                                href={rdo.pdf_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-900 tooltip"
                                title="Visualizar PDF"
                              >
                                <FontAwesomeIcon icon={faEye} size="lg" />
                              </a>
                              
                              {/* Baixar */}
                              <a 
                                href={rdo.pdf_url} 
                                download={`RDO_${rdo.rdo_numero}.pdf`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-900 tooltip"
                                title="Baixar PDF"
                              >
                                <FontAwesomeIcon icon={faFileDownload} size="lg" />
                              </a>
                            </>
                          ) : (
                            // Se não tiver PDF, mostra ícone cinza desabilitado
                            <span className="text-gray-300 cursor-not-allowed" title="PDF não gerado">
                                <FontAwesomeIcon icon={faFilePdf} size="lg" />
                            </span>
                          )}

                          {/* Editar / Abrir Detalhes */}
                          <Link href={`/rdo/${rdo.id}`} className="text-indigo-600 hover:text-indigo-900" title="Editar/Detalhes">
                            <FontAwesomeIcon icon={faEdit} size="lg" />
                          </Link>

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}