// components/financeiro/AuditoriaKanban.js
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faRobot, faCheckCircle, faExclamationTriangle, 
    faSpinner, faEye, faPlayCircle, faPauseCircle, faStopCircle, faBolt, faSync
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import LancamentoDetalhesSidebar from './LancamentoDetalhesSidebar';

// --- COMPONENTE DO CARD ---
const KanbanCard = ({ item, onClick, colorBorder, showAuditButton, showReauditButton, isAuditing, onAudit }) => {
    return (
        <div 
            onClick={() => onClick(item)}
            className={`bg-white p-3 rounded-lg shadow-sm border-l-4 ${colorBorder} cursor-pointer hover:shadow-md transition-all group relative mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300`}
        >
            <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1 rounded">
                    {new Date(item.data_transacao).toLocaleDateString('pt-BR')}
                </span>
                <span className="font-bold text-xs text-gray-700">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                </span>
            </div>
            
            <div className="text-xs font-medium text-gray-800 line-clamp-2 mb-2" title={item.descricao}>
                {item.descricao}
            </div>

            <div className="flex justify-between items-center text-[10px] text-gray-400">
                <span className="truncate max-w-[100px]">{item.favorecido?.nome || item.conta?.nome}</span>
                
                {/* Botão de Primeira Auditoria */}
                {showAuditButton && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAudit(item.id); }}
                        disabled={isAuditing}
                        className={`p-1 rounded transition-colors flex items-center gap-1 font-bold ${isAuditing ? 'text-indigo-400' : 'text-indigo-600 hover:bg-indigo-50'}`}
                    >
                        {isAuditing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faRobot} />} 
                        <span className="hidden group-hover:inline">{isAuditing ? '...' : 'Auditar'}</span>
                    </button>
                )}

                {/* Botão de Re-auditoria (Divergentes) */}
                {showReauditButton && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAudit(item.id); }}
                        disabled={isAuditing}
                        className={`p-1 rounded transition-colors flex items-center gap-1 font-bold ${isAuditing ? 'text-orange-400' : 'text-orange-600 hover:bg-orange-50'}`}
                        title="Tentar auditar novamente com a IA"
                    >
                        {isAuditing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSync} />} 
                        <span className="hidden group-hover:inline">{isAuditing ? '...' : 'Re-auditar'}</span>
                    </button>
                )}

                {/* Botão Apenas Ver */}
                {!showAuditButton && !showReauditButton && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <FontAwesomeIcon icon={faEye} /> Ver
                    </div>
                )}
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
export default function AuditoriaKanban({ filters }) {
    const supabase = createClient();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    // Controles Visuais
    const [selectedLancamento, setSelectedLancamento] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [auditandoId, setAuditandoId] = useState(null);

    // --- MÁQUINA DE ESTADO PERSISTENTE ---
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [queueStats, setQueueStats] = useState({ total: 0, pending: 0, processed: 0 });
    
    // Refs para controlar o loop sem depender de renderizações
    const processingRef = useRef(false);
    const pausedRef = useRef(false);

    // 1. Busca Dados do Banco
    const { data: kanbanData, isLoading } = useQuery({
        queryKey: ['auditoriaKanban', user?.organizacao_id, filters], 
        queryFn: async () => {
            if (!user?.organizacao_id) return null;
            const { data, error } = await supabase.rpc('get_dashboard_auditoria_kanban', {
                p_organizacao_id: user.organizacao_id,
                p_filtros: filters
            });
            if (error) throw error;
            return data;
        },
        enabled: !!user?.organizacao_id,
        staleTime: Infinity 
    });

    // 2. Função de Atualização Otimista
    const moveCardOptimistically = (lancamentoId, resultData) => {
        queryClient.setQueryData(['auditoriaKanban', user?.organizacao_id, filters], (oldData) => {
            if (!oldData) return oldData;

            // Procura o item em todas as possíveis origens (Fila IA ou Divergente)
            let item = oldData.fila_ia.find(i => i.id === lancamentoId) || 
                       oldData.divergente.find(i => i.id === lancamentoId);
            
            if (!item) return oldData;

            // Cria o item atualizado
            const updatedItem = { 
                ...item, 
                status_auditoria_ia: resultData.status 
            };

            // Remove de onde ele estava
            const novaFilaIa = oldData.fila_ia.filter(i => i.id !== lancamentoId);
            const novoDivergenteLista = oldData.divergente.filter(i => i.id !== lancamentoId); // Remove da lista antiga de divergentes
            const novoAprovadoLista = oldData.aprovado.filter(i => i.id !== lancamentoId);

            let listaFinalDivergente = novoDivergenteLista;
            let listaFinalAprovado = novoAprovadoLista;

            // Adiciona no destino
            if (resultData.status === 'Aprovado') {
                listaFinalAprovado = [updatedItem, ...novoAprovadoLista];
            } else {
                listaFinalDivergente = [updatedItem, ...novoDivergenteLista];
            }

            return {
                ...oldData,
                fila_ia: novaFilaIa,
                aprovado: listaFinalAprovado,
                divergente: listaFinalDivergente
            };
        });
    };

    // 3. Processador da Fila
    const processQueue = useCallback(async () => {
        const storedQueue = JSON.parse(localStorage.getItem('audit_queue') || '[]');
        
        if (storedQueue.length === 0) {
            setIsBulkProcessing(false);
            processingRef.current = false;
            localStorage.removeItem('audit_is_running');
            toast.success("Processamento da fila concluído!");
            return;
        }

        if (pausedRef.current) {
            setIsBulkProcessing(true);
            return; 
        }

        setIsBulkProcessing(true);
        processingRef.current = true;
        localStorage.setItem('audit_is_running', 'true');

        const nextId = storedQueue[0];
        setAuditandoId(nextId);

        try {
            const response = await fetch('/api/financeiro/auditoria-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lancamentoId: nextId })
            });

            const result = await response.json();

            if (response.ok) {
                moveCardOptimistically(nextId, result);
            } else {
                console.error("Erro ao auditar:", result);
            }

        } catch (error) {
            console.error("Erro crítico no loop:", error);
        } finally {
            const newQueue = storedQueue.slice(1);
            localStorage.setItem('audit_queue', JSON.stringify(newQueue));
            
            const totalInicial = parseInt(localStorage.getItem('audit_total_initial') || '0');
            setQueueStats({
                total: totalInicial,
                pending: newQueue.length,
                processed: totalInicial - newQueue.length
            });

            await new Promise(r => setTimeout(r, 800));

            if (newQueue.length > 0 && !pausedRef.current) {
                processQueue();
            } else if (newQueue.length === 0) {
                setIsBulkProcessing(false);
                setAuditandoId(null);
                localStorage.removeItem('audit_is_running');
                localStorage.removeItem('audit_queue');
                toast.success("Todos os itens foram auditados!");
            }
        }
    }, [user?.organizacao_id, filters, queryClient]);

    // 4. Efeito de Inicialização
    useEffect(() => {
        const wasRunning = localStorage.getItem('audit_is_running');
        const queue = JSON.parse(localStorage.getItem('audit_queue') || '[]');
        const total = parseInt(localStorage.getItem('audit_total_initial') || '0');

        if (queue.length > 0) {
            setQueueStats({
                total: total || queue.length,
                pending: queue.length,
                processed: (total || queue.length) - queue.length
            });
            setIsBulkProcessing(true);
            
            if (wasRunning === 'true') {
                pausedRef.current = false;
                setIsPaused(false);
                if (!processingRef.current) processQueue();
            } else {
                pausedRef.current = true;
                setIsPaused(true);
            }
        }
    }, [processQueue]);

    // 5. Handlers
    const handleStartBulk = () => {
        const itensIds = kanbanData?.fila_ia.map(i => i.id) || [];
        if (itensIds.length === 0) return toast.info("Fila vazia!");

        localStorage.setItem('audit_queue', JSON.stringify(itensIds));
        localStorage.setItem('audit_total_initial', itensIds.length.toString());
        
        pausedRef.current = false;
        setIsPaused(false);
        processQueue();
    };

    const handlePause = () => {
        pausedRef.current = true;
        setIsPaused(true);
        localStorage.removeItem('audit_is_running');
    };

    const handleResume = () => {
        pausedRef.current = false;
        setIsPaused(false);
        processQueue();
    };

    const handleStop = () => {
        pausedRef.current = true;
        setIsBulkProcessing(false);
        setAuditandoId(null);
        localStorage.removeItem('audit_queue');
        localStorage.removeItem('audit_is_running');
        setQueueStats({ total: 0, pending: 0, processed: 0 });
    };

    const handleSingleAudit = async (id) => {
        setAuditandoId(id);
        try {
            const response = await fetch('/api/financeiro/auditoria-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lancamentoId: id })
            });
            const result = await response.json();
            if (response.ok) {
                toast.success(`Auditoria: ${result.status}`);
                moveCardOptimistically(id, result);
            } else {
                toast.error(result.error);
            }
        } catch (e) {
            toast.error("Erro ao auditar.");
        } finally {
            setAuditandoId(null);
        }
    };

    const handleOpenDetails = (item) => {
        setSelectedLancamento({ ...item, anexos: item.anexos_detalhes || [] });
        setIsSidebarOpen(true);
    };

    const handleCloseSidebar = () => {
        setIsSidebarOpen(false);
        setTimeout(() => setSelectedLancamento(null), 300);
        queryClient.invalidateQueries({ queryKey: ['auditoriaKanban'] });
    };

    if (isLoading) return <div className="p-10 text-center"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" /><p className="mt-2 text-gray-500">Montando quadro de auditoria...</p></div>;
    if (!kanbanData) return null;

    return (
        <>
            <LancamentoDetalhesSidebar open={isSidebarOpen} onClose={handleCloseSidebar} lancamento={selectedLancamento} />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[calc(100vh-200px)] min-h-[500px]">
                
                {/* COLUNA 1: Sem Anexo */}
                <div className="flex flex-col bg-gray-50 rounded-xl border border-gray-200 h-full">
                    <div className="p-3 border-b border-gray-200 bg-gray-100 rounded-t-xl flex justify-between items-center sticky top-0 z-10">
                        <h3 className="font-bold text-gray-600 text-sm flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span> Sem Anexo
                        </h3>
                        <span className="bg-white px-2 py-0.5 rounded text-xs font-bold text-gray-500 shadow-sm">{kanbanData.sem_anexo.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                        {kanbanData.sem_anexo.map(item => (
                            <KanbanCard key={item.id} item={item} onClick={handleOpenDetails} colorBorder="border-l-gray-400" />
                        ))}
                    </div>
                </div>

                {/* COLUNA 2: Fila da IA */}
                <div className="flex flex-col bg-indigo-50 rounded-xl border border-indigo-100 h-full">
                    <div className="p-3 border-b border-indigo-200 bg-indigo-100 rounded-t-xl flex flex-col gap-2 sticky top-0 z-10">
                        <div className="flex justify-between items-center w-full">
                            <h3 className="font-bold text-indigo-700 text-sm flex items-center gap-2">
                                <FontAwesomeIcon icon={faBolt} className="text-yellow-500" /> Fila da IA
                            </h3>
                            <span className="bg-white px-2 py-0.5 rounded text-xs font-bold text-indigo-600 shadow-sm">{kanbanData.fila_ia.length}</span>
                        </div>

                        {/* CONTROLES */}
                        {kanbanData.fila_ia.length > 0 && !isBulkProcessing && (
                            <button onClick={handleStartBulk} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02]">
                                <FontAwesomeIcon icon={faPlayCircle} /> Auditar Todos ({kanbanData.fila_ia.length})
                            </button>
                        )}

                        {/* STATUS */}
                        {isBulkProcessing && (
                            <div className="bg-white p-2 rounded border border-indigo-200 shadow-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-bold text-indigo-800">
                                        {isPaused ? 'Pausado' : 'Processando...'} {queueStats.processed}/{queueStats.total}
                                    </span>
                                    <div className="flex gap-1">
                                        {isPaused ? (
                                            <button onClick={handleResume} className="text-green-600 hover:bg-green-50 p-1 rounded"><FontAwesomeIcon icon={faPlayCircle} /></button>
                                        ) : (
                                            <button onClick={handlePause} className="text-yellow-600 hover:bg-yellow-50 p-1 rounded"><FontAwesomeIcon icon={faPauseCircle} /></button>
                                        )}
                                        <button onClick={handleStop} className="text-red-500 hover:bg-red-50 p-1 rounded"><FontAwesomeIcon icon={faStopCircle} /></button>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-1.5 rounded-full transition-all duration-500 ${isPaused ? 'bg-yellow-400' : 'bg-indigo-600'}`} style={{ width: `${(queueStats.processed / queueStats.total) * 100}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin space-y-2">
                        {kanbanData.fila_ia.map(item => (
                            <KanbanCard 
                                key={item.id} 
                                item={item} 
                                onClick={handleOpenDetails} 
                                colorBorder="border-l-indigo-500"
                                showAuditButton={!isBulkProcessing}
                                isAuditing={auditandoId === item.id}
                                onAudit={handleSingleAudit}
                            />
                        ))}
                    </div>
                </div>

                {/* COLUNA 3: Divergente */}
                <div className="flex flex-col bg-orange-50 rounded-xl border border-orange-100 h-full">
                    <div className="p-3 border-b border-orange-200 bg-orange-100 rounded-t-xl flex justify-between items-center sticky top-0 z-10">
                        <h3 className="font-bold text-orange-700 text-sm flex items-center gap-2">
                            <FontAwesomeIcon icon={faExclamationTriangle} /> Divergente
                        </h3>
                        <span className="bg-white px-2 py-0.5 rounded text-xs font-bold text-orange-600 shadow-sm">{kanbanData.divergente.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                        {kanbanData.divergente.map(item => (
                            <KanbanCard 
                                key={item.id} 
                                item={item} 
                                onClick={handleOpenDetails} 
                                colorBorder="border-l-orange-500"
                                showReauditButton={true} // <--- NOVIDADE AQUI!
                                isAuditing={auditandoId === item.id}
                                onAudit={handleSingleAudit}
                            />
                        ))}
                    </div>
                </div>

                {/* COLUNA 4: Aprovado */}
                <div className="flex flex-col bg-green-50 rounded-xl border border-green-100 h-full">
                    <div className="p-3 border-b border-green-200 bg-green-100 rounded-t-xl flex justify-between items-center sticky top-0 z-10">
                        <h3 className="font-bold text-green-700 text-sm flex items-center gap-2">
                            <FontAwesomeIcon icon={faCheckCircle} /> Aprovado
                        </h3>
                        <span className="bg-white px-2 py-0.5 rounded text-xs font-bold text-green-600 shadow-sm">{kanbanData.aprovado.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                        {kanbanData.aprovado.map(item => (
                            <KanbanCard key={item.id} item={item} onClick={handleOpenDetails} colorBorder="border-l-green-500" />
                        ))}
                    </div>
                </div>

            </div>
        </>
    );
}