"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faChartLine, faChartBar, faScaleBalanced, faExclamationTriangle, faPlus, faChevronDown, faCheck, faTrash } from '@fortawesome/free-solid-svg-icons';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import AtivoFormModal from './AtivoFormModal';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

export default function AtivosManager({ contas }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, hasPermission } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // -------------------------------------------------------
    // Contas patrimoniais (Ativo / Passivo)
    // -------------------------------------------------------
    const contasPatrimoniais = useMemo(() => {
        if (!contas) return [];
        return contas.filter(c => c.tipo === 'Conta de Ativo' || c.tipo === 'Conta de Passivo');
    }, [contas]);

    const contasAgrupadas = useMemo(() => {
        const grupos = {};
        contasPatrimoniais.forEach(c => {
            const tipo = c.tipo || 'Outros';
            if (!grupos[tipo]) grupos[tipo] = [];
            grupos[tipo].push(c);
        });
        return Object.entries(grupos).map(([tipo, listaContas]) => ({
            tipo,
            contas: listaContas.sort((a, b) => a.nome.localeCompare(b.nome))
        }));
    }, [contasPatrimoniais]);

    // -------------------------------------------------------
    // Estados
    // -------------------------------------------------------
    const [contaSelecionadaId, setContaSelecionadaId] = useState(() => contasPatrimoniais[0]?.id || '');
    const [isDropdownContaOpen, setIsDropdownContaOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const dropdownContaRef = useRef(null);

    // Meses disponíveis (últimos 24 meses + "Todos")
    const mesesDisponiveis = useMemo(() => {
        const meses = [{ label: 'Todos os registros', value: 'todos' }];
        for (let i = 0; i < 24; i++) {
            const d = subMonths(new Date(), i);
            meses.push({
                label: format(d, 'MMMM yyyy', { locale: ptBR }),
                value: format(startOfMonth(d), 'yyyy-MM-dd'),
                fim: format(endOfMonth(d), 'yyyy-MM-dd'),
            });
        }
        return meses;
    }, []);
    const [mesSelecionado, setMesSelecionado] = useState(mesesDisponiveis[1]); // Mês atual

    // Click fora fecha dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownContaRef.current && !dropdownContaRef.current.contains(e.target)) {
                setIsDropdownContaOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const contaSelecionada = contasPatrimoniais.find(c => c.id == contaSelecionadaId);

    // -------------------------------------------------------
    // Query: lançamentos da conta selecionada
    // -------------------------------------------------------
    const { data: lancamentos = [], isLoading, isError, error } = useQuery({
        queryKey: ['patrimonio', contaSelecionadaId, mesSelecionado.value, organizacaoId],
        queryFn: async () => {
            if (!contaSelecionadaId || !organizacaoId) return [];
            let query = supabase
                .from('lancamentos')
                .select(`*, categoria:categorias_financeiras(nome)`)
                .eq('organizacao_id', organizacaoId)
                .eq('conta_id', contaSelecionadaId)
                .in('tipo', ['Ativo', 'Passivo'])
                .order('data_transacao', { ascending: false });

            if (mesSelecionado.value !== 'todos') {
                query = query
                    .gte('data_transacao', mesSelecionado.value)
                    .lte('data_transacao', mesSelecionado.fim);
            }
            const { data, error } = await query;
            if (error) throw new Error(error.message);
            return data || [];
        },
        enabled: !!contaSelecionadaId && !!organizacaoId,
    });

    // -------------------------------------------------------
    // KPIs Globais (sobre TODAS as contas patrimoniais)
    // -------------------------------------------------------
    const { data: kpisGlobais } = useQuery({
        queryKey: ['patrimonio-kpis', organizacaoId],
        queryFn: async () => {
            const { data } = await supabase
                .from('lancamentos')
                .select('tipo, valor')
                .eq('organizacao_id', organizacaoId)
                .in('tipo', ['Ativo', 'Passivo']);
            const totalAtivos = (data || []).filter(l => l.tipo === 'Ativo').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
            const totalPassivos = (data || []).filter(l => l.tipo === 'Passivo').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
            return { totalAtivos, totalPassivos, liquido: totalAtivos - totalPassivos };
        },
        enabled: !!organizacaoId,
    });

    // -------------------------------------------------------
    // Deletar lançamento
    // -------------------------------------------------------
    const handleDelete = async (id) => {
        if (!window.confirm('Excluir este registro patrimonial?')) return;
        const { error } = await supabase.from('lancamentos').delete().eq('id', id);
        if (error) { toast.error('Erro ao excluir'); return; }
        toast.success('Registro excluído');
        queryClient.invalidateQueries({ queryKey: ['patrimonio'] });
    };

    // -------------------------------------------------------
    // Tela sem contas cadastradas
    // -------------------------------------------------------
    if (contasPatrimoniais.length === 0) {
        return (
            <div className="text-center py-16 px-4">
                <div className="text-6xl mb-4">🏛️</div>
                <h2 className="text-2xl font-bold text-gray-700 mb-2">Nenhuma conta patrimonial cadastrada</h2>
                <p className="text-gray-500 max-w-md mx-auto">
                    Vá em <strong>Contas</strong>, crie uma conta do tipo <strong>"Conta de Ativo"</strong> (para bens e direitos) ou <strong>"Conta de Passivo"</strong> (para dívidas e obrigações).
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* ---- KPIs Globais ---- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border p-4 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                        <FontAwesomeIcon icon={faChartLine} className="text-purple-600 text-xl" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Total Ativos</p>
                        <p className="text-xl font-bold text-purple-700">{formatCurrency(kpisGlobais?.totalAtivos)}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border p-4 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                        <FontAwesomeIcon icon={faChartBar} className="text-orange-600 text-xl" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Total Passivos</p>
                        <p className="text-xl font-bold text-orange-700">{formatCurrency(kpisGlobais?.totalPassivos)}</p>
                    </div>
                </div>
                <div className={`bg-white rounded-xl border p-4 shadow-sm flex items-center gap-4 ${(kpisGlobais?.liquido || 0) >= 0 ? 'border-green-200' : 'border-red-200'}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${(kpisGlobais?.liquido || 0) >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                        <FontAwesomeIcon icon={faScaleBalanced} className={`text-xl ${(kpisGlobais?.liquido || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Patrimônio Líquido</p>
                        <p className={`text-xl font-bold ${(kpisGlobais?.liquido || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(kpisGlobais?.liquido)}</p>
                    </div>
                </div>
            </div>

            {/* ---- Seletor de Conta + Mês + Botão Novo ---- */}
            <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-col md:flex-row gap-3 items-start md:items-center">
                {/* Dropdown de Conta */}
                <div className="relative flex-1" ref={dropdownContaRef}>
                    <button
                        onClick={() => setIsDropdownContaOpen(o => !o)}
                        className="w-full flex items-center justify-between gap-3 bg-gray-50 border-2 border-gray-200 hover:border-indigo-400 rounded-xl px-4 py-3 transition-all"
                    >
                        <div className="text-left overflow-hidden">
                            {contaSelecionada ? (
                                <>
                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest truncate">{contaSelecionada.tipo}</p>
                                    <p className="text-[13px] font-bold text-gray-800 truncate">{contaSelecionada.nome}</p>
                                </>
                            ) : (
                                <p className="text-sm text-gray-500">Selecione uma conta patrimonial</p>
                            )}
                        </div>
                        <FontAwesomeIcon icon={faChevronDown} className={`text-gray-400 transition-transform ${isDropdownContaOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownContaOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-xl shadow-2xl z-50 overflow-hidden max-h-72 overflow-y-auto">
                            {contasAgrupadas.map(grupo => (
                                <div key={grupo.tipo} className="p-2">
                                    <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1.5 pl-2 mb-1">
                                        <span className="w-1 h-1 rounded-full bg-indigo-300"></span>
                                        {grupo.tipo}
                                    </h4>
                                    {grupo.contas.map(conta => {
                                        const isSelected = conta.id == contaSelecionadaId;
                                        return (
                                            <button
                                                key={conta.id}
                                                onClick={() => { setContaSelecionadaId(conta.id); setIsDropdownContaOpen(false); }}
                                                className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 mb-1 transition-all ${isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50'}`}
                                            >
                                                <div className="text-left">
                                                    <p className="text-[13px] font-bold text-gray-800">{conta.nome}</p>
                                                    {conta.empresa && <p className="text-[10px] text-gray-400">{conta.empresa.nome_fantasia || conta.empresa.razao_social}</p>}
                                                </div>
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300'}`}>
                                                    {isSelected && <FontAwesomeIcon icon={faCheck} className="text-[10px]" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Seletor de Mês */}
                <select
                    value={mesSelecionado.value}
                    onChange={e => setMesSelecionado(mesesDisponiveis.find(m => m.value === e.target.value))}
                    className="border-2 border-gray-200 rounded-xl px-3 py-3 text-sm font-medium focus:border-indigo-400 outline-none md:w-48"
                >
                    {mesesDisponiveis.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                </select>

                {/* Botão Novo */}
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-3 rounded-xl transition-colors whitespace-nowrap"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Registrar Patrimônio
                </button>
            </div>

            {/* ---- Tabela de Lançamentos ---- */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="text-center py-12 text-gray-500">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-2" />
                        <p>Carregando registros...</p>
                    </div>
                ) : isError ? (
                    <div className="text-center py-12 text-red-500">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl mb-2" />
                        <p>{error.message}</p>
                    </div>
                ) : lancamentos.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <div className="text-4xl mb-3">📋</div>
                        <p className="font-medium">Nenhum registro neste período</p>
                        <p className="text-sm mt-1">Clique em "Registrar Patrimônio" para adicionar</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase text-xs">Data</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase text-xs">Descrição</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase text-xs">Tipo</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase text-xs">Categoria</th>
                                <th className="px-4 py-3 text-right font-bold text-gray-500 uppercase text-xs">Valor</th>
                                {hasPermission?.('financeiro') && <th className="px-4 py-3 text-center font-bold text-gray-500 uppercase text-xs">Ação</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {lancamentos.map(l => (
                                <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(l.data_transacao)}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">{l.descricao}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${l.tipo === 'Ativo' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {l.tipo}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{l.categoria?.nome || '—'}</td>
                                    <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${l.tipo === 'Ativo' ? 'text-purple-700' : 'text-orange-700'}`}>
                                        {formatCurrency(l.valor)}
                                    </td>
                                    {hasPermission?.('financeiro') && (
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleDelete(l.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                            <tr>
                                <td colSpan="4" className="px-4 py-3 text-right font-bold text-gray-600 text-sm">Total do período:</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-800 text-sm whitespace-nowrap">
                                    {formatCurrency(lancamentos.reduce((s, l) => s + parseFloat(l.valor || 0), 0))}
                                </td>
                                {hasPermission?.('financeiro') && <td />}
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>

            {/* ---- Modal ---- */}
            <AtivoFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['patrimonio'] })}
                contasPatrimoniais={contasPatrimoniais}
            />
        </div>
    );
}