"use client";

import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faBuilding, faPlus, faArrowLeft, faChevronDown, faChevronRight, faArchive, faSpinner } from '@fortawesome/free-solid-svg-icons';
import EmpreendimentoDetailWrapper from './EmpreendimentoDetailWrapper';
import EmpreendimentoFormModal from './EmpreendimentoFormModal';
import { faCity, faHouse } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function EmpreendimentoManager({ initialEmpreendimentos }) {
  const { user, hasPermission } = useAuth();
  const organizacaoId = user?.organizacao_id;
  const canCreate = hasPermission('empreendimentos', 'pode_criar');

  const supabase = createClient();
  const queryClient = useQueryClient();

  const empreendimentos = initialEmpreendimentos || [];
  const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);

  // Estados para atualização do status e modal de confirmação
  const [isUpdatingId, setIsUpdatingId] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null); // { id, currentStatus, nome }

  const filteredAtivos = useMemo(() => {
    let ativos = empreendimentos.filter(e => !e.arquivado);
    if (!searchTerm) return ativos;
    const lowerTerm = searchTerm.toLowerCase();
    return ativos.filter(e => e.nome?.toLowerCase().includes(lowerTerm) || e.status?.toLowerCase().includes(lowerTerm));
  }, [empreendimentos, searchTerm]);

  const filteredArquivados = useMemo(() => {
    let arquivados = empreendimentos.filter(e => e.arquivado);
    if (!searchTerm) return arquivados;
    const lowerTerm = searchTerm.toLowerCase();
    return arquivados.filter(e => e.nome?.toLowerCase().includes(lowerTerm) || e.status?.toLowerCase().includes(lowerTerm));
  }, [empreendimentos, searchTerm]);

  // Mutação para atualizar o status no banco
  const updateVendaStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      setIsUpdatingId(id);
      const { error } = await supabase
        .from('empreendimentos')
        .update({ listado_para_venda: status })
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }
      return { id, status };
    },
    onSuccess: ({ id, status }) => {
      toast.success(status ? "Empreendimento listado para venda!" : "Removido da listagem de venda.");
      queryClient.invalidateQueries({ queryKey: ['empreendimentos', organizacaoId] });
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
    onSettled: () => {
      setIsUpdatingId(null);
    }
  });

  const handleToggleClick = (e, empreendimento) => {
    e.stopPropagation();
    e.preventDefault();
    setConfirmToggle({
      id: empreendimento.id,
      currentStatus: empreendimento.listado_para_venda || false,
      nome: empreendimento.nome
    });
  };

  const handleConfirmToggle = () => {
    if (confirmToggle) {
      updateVendaStatus.mutate({ 
        id: confirmToggle.id, 
        status: !confirmToggle.currentStatus 
      });
      setConfirmToggle(null);
    }
  };

  const statusColors = {
    'Breve Lançamento': 'bg-purple-100 text-purple-800',
    'Lançamento': 'bg-green-100 text-green-800',
    'Em Obras': 'bg-blue-100 text-blue-800',
    'Pronto para Morar': 'bg-indigo-100 text-indigo-800'
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-gray-50/50 rounded-xl shadow-inner border border-gray-200 animate-fade-in">
      {/* PAINEL ESQUERDO: LISTA (MASTER) */}
      <div className={`border-r border-gray-200 bg-white flex flex-col h-full shadow-sm z-10 ${selectedEmpreendimentoId ? 'hidden md:flex md:w-1/3 md:min-w-[320px] md:max-w-[400px]' : 'w-full md:w-1/3 md:min-w-[320px] md:max-w-[400px]'}`}>
        {/* Cabeçalho da Lista */}
        <div className="p-5 border-b border-gray-100 space-y-4 shrink-0 bg-white">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold tracking-tight text-gray-900">Empreendimentos</h2>
            {canCreate && (
              <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2 hover:shadow-md active:scale-95">
                <FontAwesomeIcon icon={faPlus} /> Novo
              </button>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar obras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 block w-full rounded-xl border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-blue-500 focus:bg-white text-sm py-2.5 transition-colors shadow-sm"
            />
          </div>
        </div>

        {/* Lista Scrollável */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/30">
          {filteredAtivos.length === 0 && filteredArquivados.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-3">
              <FontAwesomeIcon icon={faBuilding} className="text-4xl opacity-50" />
              <p className="text-sm font-medium">Nenhum empreendimento encontrado.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 p-2 space-y-1">
              {filteredAtivos.map(empreendimento => {
                const isSelected = selectedEmpreendimentoId === empreendimento.id;
                const initials = (empreendimento.nome || 'E').substring(0, 2).toUpperCase();
                return (
                  <li key={empreendimento.id}>
                    <div className={`w-full p-3 rounded-xl transition-all duration-200 flex gap-3 items-center justify-between border ${isSelected ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-500/50' : 'bg-white border-transparent hover:border-gray-200 hover:shadow-sm'}`}>
                      {/* Área clicável principal para selecionar o empreendimento */}
                      <button 
                        onClick={() => setSelectedEmpreendimentoId(empreendimento.id)} 
                        className="flex-1 min-w-0 flex gap-3 items-center text-left focus:outline-none"
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-colors bg-cover bg-center ${isSelected ? 'shadow-inner' : ''}`} style={{ backgroundImage: empreendimento.imagem_capa_url ? `url(${empreendimento.imagem_capa_url})` : 'none', backgroundColor: !empreendimento.imagem_capa_url ? (isSelected ? '#2563EB' : '#F3F4F6') : undefined, color: !empreendimento.imagem_capa_url ? (isSelected ? 'white' : '#6B7280') : undefined }}>
                          {!empreendimento.imagem_capa_url && initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-bold truncate ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>{empreendimento.nome}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded flex items-center gap-1 bg-gray-100 text-gray-700`}>
                              <FontAwesomeIcon icon={empreendimento.categoria === 'Horizontal' ? faHouse : faCity} /> {empreendimento.categoria || 'Vertical'}
                            </span>
                            <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded ${statusColors[empreendimento.status] || 'bg-gray-100 text-gray-800'}`}>{empreendimento.status || 'Sem status'}</span>
                          </div>
                        </div>
                      </button>

                      {/* Botão de Toggle para Listado para Venda */}
                      <div className="shrink-0 flex items-center pl-2 border-l border-gray-100" onClick={(e) => e.stopPropagation()}>
                        {isUpdatingId === empreendimento.id ? (
                          <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400 text-xs" />
                        ) : (
                          <button
                            onClick={(e) => handleToggleClick(e, empreendimento)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${empreendimento.listado_para_venda ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-200 hover:bg-gray-300'}`}
                            title={empreendimento.listado_para_venda ? "Listado para Venda" : "Não Listado"}
                          >
                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${empreendimento.listado_para_venda ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}

              {filteredArquivados.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200/60">
                  <button 
                    onClick={() => setIsArchivedOpen(!isArchivedOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100/80 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faArchive} className="text-gray-400" />
                      <span className="text-xs font-bold uppercase tracking-wider">Arquivados ({filteredArquivados.length})</span>
                    </div>
                    <FontAwesomeIcon icon={isArchivedOpen ? faChevronDown : faChevronRight} className="text-xs text-gray-400" />
                  </button>
                  
                  {isArchivedOpen && (
                    <div className="mt-2 space-y-1">
                      {filteredArquivados.map(empreendimento => {
                        const isSelected = selectedEmpreendimentoId === empreendimento.id;
                        const initials = (empreendimento.nome || 'E').substring(0, 2).toUpperCase();
                        return (
                          <li key={empreendimento.id}>
                            <div className={`w-full p-3 rounded-xl transition-all duration-200 flex gap-3 items-center justify-between border opacity-70 hover:opacity-100 ${isSelected ? 'bg-gray-100 border-gray-300 shadow-sm ring-1 ring-gray-400' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}>
                              <button 
                                onClick={() => setSelectedEmpreendimentoId(empreendimento.id)} 
                                className="flex-1 min-w-0 flex gap-3 items-center text-left focus:outline-none"
                              >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-colors bg-cover bg-center grayscale`} style={{ backgroundImage: empreendimento.imagem_capa_url ? `url(${empreendimento.imagem_capa_url})` : 'none', backgroundColor: !empreendimento.imagem_capa_url ? (isSelected ? '#4B5563' : '#E5E7EB') : undefined, color: !empreendimento.imagem_capa_url ? (isSelected ? 'white' : '#9CA3AF') : undefined }}>
                                  {!empreendimento.imagem_capa_url && initials}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-bold truncate ${isSelected ? 'text-gray-800' : 'text-gray-500 line-through'}`}>{empreendimento.nome}</p>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded flex items-center gap-1 bg-gray-200 text-gray-600`}>
                                      <FontAwesomeIcon icon={empreendimento.categoria === 'Horizontal' ? faHouse : faCity} /> {empreendimento.categoria || 'Vertical'}
                                    </span>
                                    <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded bg-gray-200 text-gray-600`}>Arquivado</span>
                                  </div>
                                </div>
                              </button>

                              {/* Toggle Listado para Venda para Arquivados */}
                              <div className="shrink-0 flex items-center pl-2 border-l border-gray-200" onClick={(e) => e.stopPropagation()}>
                                {isUpdatingId === empreendimento.id ? (
                                  <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400 text-xs" />
                                ) : (
                                  <button
                                    onClick={(e) => handleToggleClick(e, empreendimento)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${empreendimento.listado_para_venda ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 hover:bg-gray-400'}`}
                                    title={empreendimento.listado_para_venda ? "Listado para Venda" : "Não Listado"}
                                  >
                                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${empreendimento.listado_para_venda ? 'translate-x-4' : 'translate-x-0'}`} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* PAINEL DIREITO: DETALHES (DETAIL) */}
      <div className={`bg-white overflow-y-auto custom-scrollbar relative ${selectedEmpreendimentoId ? 'flex-1 w-full flex flex-col' : 'hidden md:flex flex-1 flex-col'}`}>
        {!selectedEmpreendimentoId ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 space-y-4">
            <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center shadow-inner mb-2">
              <FontAwesomeIcon icon={faBuilding} className="text-5xl text-gray-300" />
            </div>
            <h3 className="text-xl font-medium text-gray-600">Nenhum empreendimento selecionado</h3>
            <p className="text-sm max-w-sm text-center">
              Selecione um empreendimento na lista ao lado para gerenciar arquivos, ficha completas, tabela de vendas e modelos de contrato.
            </p>
          </div>
        ) : (
          <>
            {/* Cabeçalho Mobile de Voltar */}
            <div className="md:hidden bg-white p-3 border-b border-gray-200 flex items-center gap-3 shadow-sm sticky top-0 z-20">
              <button onClick={() => setSelectedEmpreendimentoId(null)} className="text-gray-600 px-3 py-2 hover:bg-gray-100 rounded-lg flex items-center gap-2 font-bold text-sm transition-colors">
                <FontAwesomeIcon icon={faArrowLeft} /> Voltar
              </button>
              <h2 className="font-bold text-gray-800 flex-1 truncate text-sm">
                {empreendimentos.find(e => e.id === selectedEmpreendimentoId)?.nome || 'Empreendimento'}
              </h2>
            </div>
            <EmpreendimentoDetailWrapper empreendimentoId={selectedEmpreendimentoId} organizacaoId={organizacaoId} />
          </>
        )}
      </div>

      <EmpreendimentoFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* MODAL DE CONFIRMAÇÃO PREMIUM DE TOGGLE */}
      {confirmToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-6 space-y-4 animate-scale-up">
            <h3 className="text-lg font-bold text-gray-900">Confirmar alteração de listagem</h3>
            <p className="text-sm text-gray-500">
              Você tem certeza que deseja {confirmToggle.currentStatus ? 'remover' : 'adicionar'} o empreendimento <strong className="text-gray-800">"{confirmToggle.nome}"</strong> {confirmToggle.currentStatus ? 'da' : 'na'} listagem para venda?
            </p>
            {confirmToggle.currentStatus ? (
              <p className="text-xs text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100">
                ⚠️ <strong>Atenção:</strong> Ao remover da listagem, a Stella IA e as ferramentas automatizadas de WhatsApp não conseguirão enviar os books e materiais deste empreendimento.
              </p>
            ) : (
              <p className="text-xs text-green-600 bg-green-50 p-2.5 rounded-lg border border-green-100">
                ✅ <strong>Informação:</strong> Ao listar para venda, a Stella IA e corretores no WhatsApp poderão enviar os materiais e books deste projeto de forma automática.
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setConfirmToggle(null)} 
                className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmToggle} 
                className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors active:scale-95 shadow-sm hover:shadow ${confirmToggle.currentStatus ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                Sim, confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
