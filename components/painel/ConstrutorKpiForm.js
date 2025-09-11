"use client";

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// Funções para buscar os filtros (categorias e contas)
const fetchFinanceFilters = async () => {
    const supabase = createClient();
    const { data: categorias, error: catError } = await supabase.from('categorias_financeiras').select('id, nome, tipo');
    if (catError) throw new Error(catError.message);

    const { data: contas, error: contaError } = await supabase.from('contas_financeiras').select('id, nome');
    if (contaError) throw new Error(contaError.message);

    return { categorias, contas };
};

export default function ConstrutorKpiForm({ kpi, onClose }) {
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [modulo, setModulo] = useState('financeiro');
    const [tipoCalculo, setTipoCalculo] = useState('soma_valores');
    
    // Estado para os filtros
    const [selectedCategorias, setSelectedCategorias] = useState([]);
    const [selectedContas, setSelectedContas] = useState([]);
    const [tipoLancamento, setTipoLancamento] = useState(''); // 'Receita' ou 'Despesa'
    const [periodo, setPeriodo] = useState('mes_atual');

    const queryClient = useQueryClient();
    const supabase = createClient();

    // Busca os dados para preencher os filtros
    const { data: filterData, isLoading: isLoadingFilters } = useQuery({
        queryKey: ['financeFilters'],
        queryFn: fetchFinanceFilters,
    });

    const { mutate: saveKpi, isPending } = useMutation({
        mutationFn: async (kpiData) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuário não autenticado.");

            const { error } = await supabase
                .from('kpis_personalizados')
                .insert([{ ...kpiData, usuario_id: user.id }]);
            
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kpisPersonalizados'] });
            onClose(); // Fecha o formulário após o sucesso
        },
        onError: (error) => {
            alert(`Erro ao salvar KPI: ${error.message}`);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const filtros = {
            tipo_lancamento: tipoLancamento,
            periodo: periodo,
            categoria_ids: selectedCategorias,
            conta_ids: selectedContas,
        };

        saveKpi({
            titulo,
            descricao,
            modulo,
            tipo_calculo: tipoCalculo,
            filtros: filtros,
        });
    };
    
    return (
        <div className="p-6 bg-white rounded-lg shadow-lg border">
            <h2 className="text-xl font-bold mb-4">{kpi ? 'Editar KPI' : 'Criar Novo KPI'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Informações Básicas */}
                <div>
                    <label htmlFor="titulo" className="block text-sm font-medium text-gray-700">Título</label>
                    <input type="text" id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </div>
                <div>
                    <label htmlFor="descricao" className="block text-sm font-medium text-gray-700">Descrição</label>
                    <textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows="2" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"></textarea>
                </div>

                {/* Módulo e Cálculo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="modulo" className="block text-sm font-medium text-gray-700">Módulo</label>
                        <select id="modulo" value={modulo} onChange={(e) => setModulo(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                            <option value="financeiro">Financeiro</option>
                            {/* Outros módulos virão aqui (compras, rh, etc.) */}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="tipo_calculo" className="block text-sm font-medium text-gray-700">O que calcular?</label>
                        <select id="tipo_calculo" value={tipoCalculo} onChange={(e) => setTipoCalculo(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                            <option value="soma_valores">Soma dos Valores (R$)</option>
                            <option value="contagem_registros">Número de Lançamentos</option>
                        </select>
                    </div>
                </div>

                <hr />
                <h3 className="text-lg font-semibold">Filtros</h3>
                
                {isLoadingFilters ? <p>Carregando filtros...</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Tipo de Lançamento</label>
                            <select value={tipoLancamento} onChange={e => setTipoLancamento(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="">Todos</option>
                                <option value="Receita">Receita</option>
                                <option value="Despesa">Despesa</option>
                            </select>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-gray-700">Período</label>
                             <select value={periodo} onChange={e => setPeriodo(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="hoje">Hoje</option>
                                <option value="mes_atual">Este Mês</option>
                                <option value="ultimos_30_dias">Últimos 30 dias</option>
                                <option value="ano_atual">Este Ano</option>
                             </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Categorias</label>
                            <select multiple value={selectedCategorias} onChange={e => setSelectedCategorias(Array.from(e.target.selectedOptions, option => option.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-32">
                                {filterData?.categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                            </select>
                            <p className="text-xs text-gray-500">Segure Ctrl (ou Cmd) para selecionar mais de um.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Contas</label>
                            <select multiple value={selectedContas} onChange={e => setSelectedContas(Array.from(e.target.selectedOptions, option => option.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-32">
                                {filterData?.contas.map(conta => <option key={conta.id} value={conta.id}>{conta.nome}</option>)}
                            </select>
                        </div>
                    </div>
                )}
                
                {/* Ações */}
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Cancelar</button>
                    <button type="submit" disabled={isPending} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center">
                        {isPending && <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />}
                        {kpi ? 'Salvar Alterações' : 'Criar KPI'}
                    </button>
                </div>
            </form>
        </div>
    );
}