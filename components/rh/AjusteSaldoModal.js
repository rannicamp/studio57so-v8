// components/rh/AjusteSaldoModal.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faCalculator, faHandHoldingDollar, faFileInvoiceDollar } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import { toast } from 'sonner';

export default function AjusteSaldoModal({ isOpen, onClose, employee, saldoTotalMinutos, onSaveSuccess }) {
    const supabase = createClient();
    const { user } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    
    // Estados para o formulário financeiro
    const [contas, setContas] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [selectedContaId, setSelectedContaId] = useState('');
    const [selectedCategoriaId, setSelectedCategoriaId] = useState('');
    const [motivo, setMotivo] = useState('');

    const isPositiveBalance = saldoTotalMinutos > 0;
    const actionText = isPositiveBalance ? 'Pagar Horas Extras' : 'Descontar Horas';
    const transactionType = isPositiveBalance ? 'Despesa' : 'Receita';

    useEffect(() => {
        if (isOpen) {
            // Define o motivo padrão
            const currentMonthYear = new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
            setMotivo(`Ref. ${isPositiveBalance ? 'pagamento' : 'desconto'} de banco de horas - ${employee.full_name} - ${currentMonthYear}`);
            
            // Busca dados financeiros
            const fetchFinancialData = async () => {
                const { data: contasData } = await supabase.from('contas_financeiras').select('id, nome').order('nome');
                setContas(contasData || []);

                // Busca a categoria específica para a ação
                const categoryName = isPositiveBalance ? 'Pagamento de Banco de Horas' : 'Desconto de Banco de Horas';
                const { data: categoriaData } = await supabase.from('categorias_financeiras').select('id, nome').eq('nome', categoryName).single();
                
                setCategorias(categoriaData ? [categoriaData] : []);
                if (categoriaData) {
                    setSelectedCategoriaId(categoriaData.id);
                } else {
                    toast.warning(`Categoria "${categoryName}" não encontrada. Crie-a no módulo Financeiro para continuar.`);
                }
            };
            fetchFinancialData();
        }
    }, [isOpen, employee, saldoTotalMinutos, isPositiveBalance, supabase]);

    const { valorHora, valorAjuste } = useMemo(() => {
        if (!employee) return { valorHora: 0, valorAjuste: 0 };
        const valorDiaria = parseFloat(String(employee.daily_value || '0').replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
        const cargaHoraria = employee.jornada?.carga_horaria_semanal || 44;
        if (valorDiaria === 0 || cargaHoraria === 0) return { valorHora: 0, valorAjuste: 0 };
        
        const valorHoraCalc = (valorDiaria * 5) / cargaHoraria;
        const valorAjusteCalc = (Math.abs(saldoTotalMinutos) / 60.0) * valorHoraCalc;
        
        return { valorHora: valorHoraCalc, valorAjuste: valorAjusteCalc };
    }, [employee, saldoTotalMinutos]);

    const formatMinutesToHours = (minutes) => {
        if (isNaN(minutes)) return '00:00';
        const sign = minutes < 0 ? '-' : '+';
        const absMinutes = Math.abs(minutes);
        const hours = Math.floor(absMinutes / 60);
        const mins = Math.round(absMinutes % 60);
        return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const handleSave = async () => {
        if (!selectedContaId || !selectedCategoriaId) {
            toast.error("Por favor, selecione a conta e verifique se a categoria financeira existe.");
            return;
        }
        setIsSaving(true);
        
        const minutosParaAjustar = -saldoTotalMinutos; // Inverte o sinal para o ajuste

        const promise = supabase.rpc('processar_ajuste_banco_horas', {
            p_funcionario_id: employee.id,
            p_minutos_ajustados: minutosParaAjustar,
            p_motivo: motivo,
            p_conta_id: selectedContaId,
            p_categoria_id: selectedCategoriaId,
            p_criado_por_usuario_id: user.id
        });

        toast.promise(promise, {
            loading: 'Processando ajuste...',
            success: (response) => {
                if (response.error) {
                    throw new Error(response.error.message);
                }
                onSaveSuccess();
                onClose();
                return response.data[0].message;
            },
            error: (err) => `Erro: ${err.message}`,
            finally: () => setIsSaving(false),
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4 no-print">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">Ajustar Saldo do Banco de Horas</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg border space-y-3">
                    <p><strong>Funcionário:</strong> {employee.full_name}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Saldo Atual</p>
                            <p className={`text-2xl font-bold ${isPositiveBalance ? 'text-green-600' : 'text-red-600'}`}>{formatMinutesToHours(saldoTotalMinutos)}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Valor/Hora Calculado</p>
                            <p className="text-2xl font-bold text-gray-700">{valorHora.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Valor do Ajuste</p>
                            <p className={`text-2xl font-bold ${isPositiveBalance ? 'text-green-600' : 'text-red-600'}`}>{valorAjuste.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} />
                        Criar Lançamento Financeiro para o Ajuste
                    </h4>
                    <div>
                        <label className="block text-sm font-medium">Conta de Origem/Destino *</label>
                        <select value={selectedContaId} onChange={(e) => setSelectedContaId(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">-- Selecione uma conta --</option>
                            {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Categoria Financeira *</label>
                        <select value={selectedCategoriaId} onChange={(e) => setSelectedCategoriaId(e.target.value)} className="mt-1 w-full p-2 border rounded-md" disabled={categorias.length === 0}>
                            {categorias.length === 0 ? <option>Categoria não encontrada</option> : categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Descrição / Motivo</label>
                        <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                </div>

                <div className="flex justify-between items-center gap-4 pt-6 mt-6 border-t">
                    <button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Manter no Banco</button>
                    <button onClick={handleSave} disabled={isSaving || !selectedContaId || !selectedCategoriaId} className={`${isPositiveBalance ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white px-6 py-3 rounded-md font-bold disabled:bg-gray-400 flex items-center gap-2`}>
                        {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faHandHoldingDollar} />}
                        {isSaving ? 'Processando...' : actionText}
                    </button>
                </div>
            </div>
        </div>
    );
}