// components/rh/LancarValeModal.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function LancarValeModal({ 
    isOpen, 
    onClose, 
    employee, 
    month,
    historicoSalarial,
    timesheetData,
    abonosData,
    holidays
}) {
    const supabase = createClient();
    const { user } = useAuth();
    const [periodo, setPeriodo] = useState({ inicio: '', fim: '' });
    const [dataPagamento, setDataPagamento] = useState('');
    const [valorCalculado, setValorCalculado] = useState(0);
    const [loading, setLoading] = useState(false);
    
    const [contas, setContas] = useState([]);
    const [contaIdSelecionada, setContaIdSelecionada] = useState('');

    useEffect(() => {
        if (isOpen) {
            const today = new Date().toISOString().split('T')[0];
            const [year, monthNum] = month.split('-');
            const firstDayOfMonth = `${year}-${monthNum}-01`;

            setPeriodo({
                inicio: firstDayOfMonth,
                fim: today,
            });
            setDataPagamento(today);

            const fetchContas = async () => {
                if (user?.organizacao_id) {
                    const { data } = await supabase
                        .from('contas_financeiras')
                        .select('id, nome')
                        .eq('organizacao_id', user.organizacao_id);
                    setContas(data || []);
                    if (data && data.length > 0) {
                        setContaIdSelecionada(data[0].id);
                    }
                }
            };
            fetchContas();
        }
    }, [isOpen, month, user, supabase]);

    const getDiariaParaData = useCallback((dateString, historico) => {
        if (!historico || historico.length === 0) return 0;
        const targetDate = new Date(dateString + 'T00:00:00Z');
        let diariaVigente = 0;
        for (const registro of historico) {
            const vigenciaDate = new Date(registro.data_inicio_vigencia + 'T00:00:00Z');
            if (vigenciaDate <= targetDate) {
                diariaVigente = parseFloat(registro.valor_diaria) || 0;
            } else {
                break;
            }
        }
        return diariaVigente;
    }, []);

    const calcularValorDoPeriodo = useCallback(() => {
        if (!periodo.inicio || !periodo.fim || !employee || !historicoSalarial) {
            return 0;
        }

        let valorTotal = 0;
        const dataInicio = new Date(periodo.inicio + 'T00:00:00Z');
        const dataFim = new Date(periodo.fim + 'T00:00:00Z');
        const todayUTC = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z');

        for (let d = new Date(dataInicio); d <= dataFim; d.setUTCDate(d.getUTCDate() + 1)) {
            const dateString = d.toISOString().split('T')[0];
            const dayOfWeek = d.getUTCDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHoliday = (holidays || []).some(h => h.data_feriado === dateString);
            
            const jornadaDoDia = employee.jornada?.detalhes?.find(j => j.dia_semana === dayOfWeek);
            const isWorkday = jornadaDoDia && jornadaDoDia.horario_entrada && jornadaDoDia.horario_saida && !isHoliday && !isWeekend;

            const temBatida = !!timesheetData[dateString];
            const temAbono = !!abonosData[dateString];
            
            let isPagavel = false;
            
            if (d <= todayUTC) {
                if (temBatida || (temAbono && isWorkday)) {
                    isPagavel = true;
                }
            } else {
                if (isWorkday) {
                    isPagavel = true;
                }
            }

            if (isPagavel) {
                valorTotal += getDiariaParaData(dateString, historicoSalarial);
            }
        }
        
        return valorTotal;

    }, [periodo, employee, historicoSalarial, timesheetData, abonosData, holidays, getDiariaParaData]);

    useEffect(() => {
        if (isOpen) {
            const valor = calcularValorDoPeriodo();
            setValorCalculado(valor);
        }
    }, [isOpen, periodo, calcularValorDoPeriodo]);

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setPeriodo(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!contaIdSelecionada) {
            toast.error("Por favor, selecione uma conta para o pagamento.");
            return;
        }
        if (valorCalculado <= 0) {
            toast.warning("O valor calculado do vale é zero. Nenhum lançamento será criado.");
            return;
        }

        setLoading(true);

        const promise = async () => {
            // =================================================================================
            // INÍCIO DA ATUALIZAÇÃO
            // O PORQUÊ: Adicionamos p_empresa_id e p_empreendimento_id à chamada da função,
            // pegando os dados diretamente do objeto 'employee'.
            // =================================================================================
            const { error } = await supabase.rpc('agendar_vale', {
                p_funcionario_id: employee.id,
                p_organizacao_id: user.organizacao_id,
                p_periodo_inicio: periodo.inicio,
                p_periodo_fim: periodo.fim,
                p_data_pagamento: dataPagamento,
                p_valor_projetado: valorCalculado,
                p_conta_id: contaIdSelecionada,
                p_empresa_id: employee.empresa_id,
                p_empreendimento_id: employee.empreendimento_atual_id
            });
            // =================================================================================
            // FIM DA ATUALIZAÇÃO
            // =================================================================================

            if (error) throw error;
        };

        toast.promise(promise(), {
            loading: 'Agendando vale...',
            success: () => {
                setLoading(false);
                onClose();
                return 'Vale agendado com sucesso no financeiro!';
            },
            error: (err) => {
                setLoading(false);
                return `Erro ao agendar: ${err.message}`;
            },
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-xl font-bold mb-4">Lançar Vale para {employee.full_name}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    <fieldset className="p-4 border rounded-md">
                        <legend className="font-semibold px-2 text-gray-700">Período para Cálculo</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Data de Início</label>
                                <input type="date" name="inicio" value={periodo.inicio} onChange={handleDateChange} required className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Data Final</label>
                                <input type="date" name="fim" value={periodo.fim} onChange={handleDateChange} required className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                        </div>
                    </fieldset>

                     <fieldset className="p-4 border rounded-md">
                        <legend className="font-semibold px-2 text-gray-700">Programação Financeira</legend>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium">Data do Pagamento</label>
                                <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} required className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Conta de Saída</label>
                                <select value={contaIdSelecionada} onChange={(e) => setContaIdSelecionada(e.target.value)} required className="mt-1 w-full p-2 border rounded-md">
                                    <option value="">Selecione a conta...</option>
                                    {contas.map(conta => (
                                        <option key={conta.id} value={conta.id}>{conta.nome}</option>
                                    ))}
                                </select>
                            </div>
                         </div>
                    </fieldset>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-center">
                        <p className="text-sm font-medium text-blue-800">Valor Calculado (Prévia)</p>
                        <p className="text-2xl font-bold text-blue-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorCalculado)}
                        </p>
                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2">
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Confirmar e Agendar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}