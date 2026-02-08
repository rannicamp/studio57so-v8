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
  faFilePdf,
  faRobot,
  faSpinner,
  faWandMagicSparkles,
  faImages,
  faList
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import RdoAutoGenerator from '../../../../components/rdo/RdoAutoGenerator'; 
// Importação correta da Galeria de Imagens dos RDOs
import RdoPhotoGallery from '../../../../components/rdo/RdoPhotoGallery';

export default function RdoGerenciadorPage() {
  const supabase =createClient();
  
  // Estados da Lista
  const [rdos, setRdos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados da Galeria
  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Controle de Abas
  const [activeTab, setActiveTab] = useState('lista'); // 'lista' ou 'galeria'

  // Estados do Robô
  const [pendingRdosForBot, setPendingRdosForBot] = useState([]);
  const [isBotWorking, setIsBotWorking] = useState(false);

  // --- BUSCA RDOs (Para a aba Lista) ---
  const fetchRdos = useCallback(async () => {
    if (isBotWorking) return; 

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('diarios_obra')
        .select(`
          *,
          empreendimentos (nome),
          usuarios (nome, sobrenome)
        `)
        .order('data_relatorio', { ascending: false });

      if (error) throw error;
      
      const allRdos = data || [];
      setRdos(allRdos);

      // --- Lógica do Robô ---
      const timeZoneOffset = new Date().getTimezoneOffset() * 60000;
      const today = new Date(Date.now() - timeZoneOffset).toISOString().split('T')[0];
      
      const pendentesAutomaticos = allRdos.filter(rdo => {
          const isPassado = rdo.data_relatorio < today;
          const isSemPdf = !rdo.pdf_url; 
          return isPassado && isSemPdf;
      });

      if (pendentesAutomaticos.length > 0) {
          console.log(`🤖 Robô detectou ${pendentesAutomaticos.length} RDOs antigos pendentes.`);
          setPendingRdosForBot(prev => {
              const currentIds = new Set(prev.map(p => p.id));
              const newItems = pendentesAutomaticos.filter(p => !currentIds.has(p.id));
              return [...prev, ...newItems];
          });
          setIsBotWorking(true);
      }
      // ----------------------

    } catch (error) {
      console.error("Erro ao buscar RDOs:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase, isBotWorking]);

  // --- BUSCA FOTOS (Para a aba Galeria) ---
  const fetchPhotos = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      // Busca as fotos e faz o join com a tabela de diarios_obra para pegar o número e data
      const { data, error } = await supabase
        .from('rdo_fotos_uploads')
        .select(`
          *,
          diarios_obra (
            id,
            rdo_numero,
            data_relatorio
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error("Erro ao buscar fotos:", error);
      toast.error("Erro ao carregar galeria de fotos.");
    } finally {
      setLoadingPhotos(false);
    }
  }, [supabase]);

  // Carregamento Inicial
  useEffect(() => {
    fetchRdos();
    // Carregamos as fotos também no início ou poderíamos carregar apenas ao clicar na aba
    fetchPhotos();
  }, [fetchRdos, fetchPhotos]);

  // Auto-Refresh (Relógio)
  useEffect(() => {
      const intervalId = setInterval(() => {
          console.log("⏰ Auto-Refresh: Verificando novos RDOs pendentes...");
          fetchRdos();
      }, 1000 * 60 * 30); 

      return () => clearInterval(intervalId);
  }, [fetchRdos]);

  // Funções do Robô
  const handleManualGenerate = (rdo) => {
      if (rdo.pdf_url && rdo.pdf_url !== 'atualizando...') {
          toast.warning("Este RDO já possui um PDF assinado.");
          return;
      }
      setRdos(prev => prev.map(r => r.id === rdo.id ? { ...r, pdf_url: 'atualizando...' } : r));
      setPendingRdosForBot(prev => [...prev, rdo]);
      setIsBotWorking(true);
      toast.info("RDO adicionado à fila de geração...");
  };

  const handleBotSuccess = (rdoId, success) => {
      if (success) {
          setPendingRdosForBot(prev => prev.filter(r => r.id !== rdoId));
      } else {
          setPendingRdosForBot(prev => prev.filter(r => r.id !== rdoId));
          setRdos(prev => prev.map(r => r.id === rdoId ? { ...r, pdf_url: null } : r));
      }

      if (pendingRdosForBot.length <= 1) {
          setIsBotWorking(false);
          setTimeout(() => fetchRdos(), 2000);
      }
  };

  // Filtro da Lista
  const filteredRdos = rdos.filter(rdo => {
    const searchLower = searchTerm.toLowerCase();
    const empNome = rdo.empreendimentos?.nome?.toLowerCase() || '';
    const rdoNum = rdo.rdo_numero?.toLowerCase() || '';
    const responsavel = rdo.responsavel_rdo?.toLowerCase() || '';
    return empNome.includes(searchLower) || rdoNum.includes(searchLower) || responsavel.includes(searchLower);
  });

  return (
    <div className="bg-gray-50 min-h-screen">
      
      <RdoAutoGenerator 
        pendingRdos={pendingRdosForBot} 
        onSuccess={handleBotSuccess} 
      />

      {/* --- CABEÇALHO E ABAS --- */}
      <div className="bg-white border-b border-gray-200 px-6 pt-6 pb-0 shadow-sm">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Gerenciador de RDOs</h1>
                <p className="text-gray-500 mt-1">Controle de relatórios e biblioteca visual.</p>
            </div>
             {/* O botão 'Novo RDO' aparece sempre, mas poderíamos esconder na aba galeria se quiser */}
             <div className="flex gap-2 items-center">
                {isBotWorking && (
                    <div className="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 animate-pulse border border-indigo-200">
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <FontAwesomeIcon icon={faRobot} />
                        Processando... ({pendingRdosForBot.length})
                    </div>
                )}
                <Link 
                    href="/rdo" 
                    className="bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 flex items-center gap-2 shadow-sm transition-all"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Novo RDO
                </Link>
            </div>
        </div>

        {/* NAVEGAÇÃO DAS ABAS */}
        <div className="flex space-x-8">
            <button
                onClick={() => setActiveTab('lista')}
                className={`pb-3 px-2 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === 'lista'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
                <FontAwesomeIcon icon={faList} />
                Lista de RDOs
            </button>
            <button
                onClick={() => setActiveTab('galeria')}
                className={`pb-3 px-2 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === 'galeria'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
                <FontAwesomeIcon icon={faImages} />
                Galeria de Fotos
            </button>
        </div>
      </div>

      {/* --- CONTEÚDO --- */}
      <div className="p-6">
        
        {activeTab === 'lista' ? (
          // ================= ABA LISTA =================
          <>
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

            <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                {loading ? (
                <div className="p-10 text-center text-gray-500">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-2" />
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
                        const dataParts = rdo.data_relatorio.split('-');
                        const dataFormatada = `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}`;
                        
                        const hasPdf = rdo.pdf_url && rdo.pdf_url !== 'atualizando...';
                        const isGenerating = rdo.pdf_url === 'atualizando...';
                        
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
                                {hasPdf ? (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    Assinado
                                </span>
                                ) : isGenerating ? (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 animate-pulse">
                                    Gerando...
                                </span> 
                                ) : (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                    Pendente
                                </span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                <div className="flex justify-center items-center gap-3">
                                {hasPdf ? (
                                    <>
                                    <a href={rdo.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900 tooltip" title="Visualizar PDF">
                                        <FontAwesomeIcon icon={faEye} size="lg" />
                                    </a>
                                    <a href={rdo.pdf_url} download={`RDO_${rdo.rdo_numero}.pdf`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-900 tooltip" title="Baixar PDF">
                                        <FontAwesomeIcon icon={faFileDownload} size="lg" />
                                    </a>
                                    </>
                                ) : (
                                    <button onClick={() => handleManualGenerate(rdo)} disabled={isGenerating || isBotWorking} className={`tooltip transition-colors ${isGenerating ? 'text-gray-400 cursor-wait' : 'text-purple-600 hover:text-purple-800'}`} title="Gerar PDF Manualmente">
                                        <FontAwesomeIcon icon={isGenerating ? faSpinner : faWandMagicSparkles} spin={isGenerating} size="lg" />
                                    </button>
                                )}
                                <div className="h-4 w-px bg-gray-300 mx-1"></div>
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
          </>
        ) : (
          // ================= ABA GALERIA =================
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            {loadingPhotos ? (
               <div className="p-10 text-center text-gray-500">
                   <FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-2" />
                   <p>Carregando galeria...</p>
               </div>
            ) : (
               <RdoPhotoGallery photos={photos} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}