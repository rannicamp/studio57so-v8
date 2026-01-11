// components/financeiro/AuditoriaFinanceira.js
"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faRobot, faCheckCircle, faTimesCircle, faExclamationTriangle, 
    faSearch, faSpinner, faFileInvoiceDollar, faEye 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Importação do Sidebar
import LancamentoDetalhesSidebar from './LancamentoDetalhesSidebar';

export default function AuditoriaFinanceira() {
    const supabase = createClient();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    // Estados para Controle da Sidebar
    const [selectedLancamento, setSelectedLancamento] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    const [auditandoId, setAuditandoId] = useState(null);

    // 1. Buscar lançamentos (Todos os recentes, inclusive aprovados)
    const { data: lancamentos = [], isLoading } = useQuery({
        queryKey: ['lancamentosAuditoria', user?.organizacao_id],
        queryFn: async () => {
            if (!user?.organizacao_id) return [];
            
            const { data, error } = await supabase
                .from('lancamentos')
                .select('*, anexos:lancamentos_anexos(*), conta:contas_financeiras(nome), categoria:categorias_financeiras(nome), favorecido:contatos(nome, razao_social)')
                .eq('organizacao_id', user.organizacao_id)
                // REMOVIDO: .neq('status_auditoria_ia', 'Aprovado') -> Agora mostramos todos para você ver o 'Aprovado' aparecer!
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            
            // Filtra apenas os que têm anexo (pois só esses podem ser auditados)
            return data.filter(l => l.anexos && l.anexos.length > 0);
        },
        enabled: !!user?.organizacao_id,
        staleTime: 1000 * 60 * 5 
    });

    // 2. Ação de Auditar
    const auditMutation = useMutation({
        mutationFn: async (lancamentoId) => {
            const response = await fetch('/api/financeiro/auditoria-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lancamentoId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro na auditoria');
            }

            return await response.json();
        },
        onMutate: (id) => setAuditandoId(id),
        onSettled: () => setAuditandoId(null),
        onSuccess: (data) => {
            toast.success(`Auditoria concluída: ${data.status}`);
            
            // CORREÇÃO: Sintaxe correta para o React Query v5 atualizar a lista
            queryClient.invalidateQueries({ queryKey: ['lancamentosAuditoria'] });
            
            if (selectedLancamento?.id === data.id) {
                 setIsSidebarOpen(false);
            }
        },
        onError: (err) => toast.error(err.message)
    });

    const handleAuditar = (e, id) => {
        e.stopPropagation(); 
        auditMutation.mutate(id);
    };

    const handleRowClick = (lancamento) => {
        setSelectedLancamento(lancamento);
        setIsSidebarOpen(true);
    };

    const handleCloseSidebar = () => {
        setIsSidebarOpen(false);
        setTimeout(() => setSelectedLancamento(null), 300);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Aprovado': return <span className="text-green-600 bg-green-100 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit"><FontAwesomeIcon icon={faCheckCircle} /> Aprovado</span>;
            case 'Divergente': return <span className="text-yellow-600 bg-yellow-100 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit"><FontAwesomeIcon icon={faExclamationTriangle} /> Divergente</span>;
            case 'Erro': return <span className="text-red-600 bg-red-100 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit"><FontAwesomeIcon icon={faTimesCircle} /> Erro Leitura</span>;
            default: return <span className="text-gray-500 bg-gray-100 px-2 py-1 rounded text-xs font-bold w-fit">Pendente</span>;
        }
    };

    return (
        <div className="space-y-6">
            <LancamentoDetalhesSidebar 
                open={isSidebarOpen} 
                onClose={handleCloseSidebar} 
                lancamento={selectedLancamento} 
            />

            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                        <FontAwesomeIcon icon={faRobot} size="2x" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Auditoria Inteligente (IA)</h2>
                        <p className="text-blue-100 opacity-90">O sistema analisa seus anexos e confere os valores automaticamente.</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-gray-400"/>
                        Histórico de Auditoria ({lancamentos.length})
                    </h3>
                    <button 
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['lancamentosAuditoria'] })}
                        className="text-sm text-blue-600 hover:underline"
                    >
                        <FontAwesomeIcon icon={faSearch} /> Atualizar Lista
                    </button>
                </div>

                {isLoading ? (
                    <div className="p-10 text-center text-gray-500">
                        <FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-2 text-blue-500"/>
                        <p>Carregando lançamentos...</p>
                    </div>
                ) : lancamentos.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">
                        <FontAwesomeIcon icon={faCheckCircle} size="3x" className="mb-4 text-green-200"/>
                        <p className="font-medium text-lg">Nenhum lançamento com anexo encontrado.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3">Data</th>
                                    <th className="px-6 py-3">Descrição</th>
                                    <th className="px-6 py-3 text-right">Valor Sistema</th>
                                    <th className="px-6 py-3 text-center">Status IA</th>
                                    <th className="px-6 py-3 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {lancamentos.map((lancamento) => (
                                    <tr 
                                        key={lancamento.id} 
                                        onClick={() => handleRowClick(lancamento)}
                                        className="hover:bg-blue-50 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4 font-mono text-gray-600">
                                            {new Date(lancamento.data_transacao).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <span>{lancamento.descricao}</span>
                                                <FontAwesomeIcon icon={faEye} className="text-gray-300 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all text-xs" />
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                {lancamento.anexos.length} anexo(s) disponível(is)
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-700">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lancamento.valor)}
                                        </td>
                                        <td className="px-6 py-4 flex justify-center">
                                            {getStatusBadge(lancamento.status_auditoria_ia)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {lancamento.status_auditoria_ia !== 'Aprovado' && (
                                                <button
                                                    onClick={(e) => handleAuditar(e, lancamento.id)}
                                                    disabled={auditandoId === lancamento.id}
                                                    className={`
                                                        px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm
                                                        ${auditandoId === lancamento.id 
                                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'
                                                        }
                                                    `}
                                                >
                                                    {auditandoId === lancamento.id ? (
                                                        <><FontAwesomeIcon icon={faSpinner} spin /> Analisando...</>
                                                    ) : (
                                                        <><FontAwesomeIcon icon={faRobot} /> Auditar</>
                                                    )}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}