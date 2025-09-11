"use client";

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSave } from '@fortawesome/free-solid-svg-icons';

import FiltroFinanceiro from '@/components/financeiro/FiltroFinanceiro';
import KpiCard from '@/components/KpiCard';

// =================================
// FUNÇÕES DE BUSCA DE DADOS
// =================================

const supabase = createClient();

// Função para buscar os dados necessários para os filtros (empresas, contas, etc.)
async function fetchFilterOptions() {
    const [empresasRes, contasRes, categoriasRes, empreendimentosRes, contatosRes] = await Promise.all([
        supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social'),
        supabase.from('contas_financeiras').select('id, nome'),
        supabase.from('categorias_financeiras').select('id, nome'),
        supabase.from('empreendimentos').select('id, nome'),
        supabase.from('contatos').select('id, nome, razao_social'),
    ]);
    return {
        empresas: empresasRes.data || [],
        contas: contasRes.data || [],
        categorias: categoriasRes.data || [],
        empreendimentos: empreendimentosRes.data || [],
        allContacts: contatosRes.data || [],
    };
}

// Função que aplica os filtros na query do Supabase (REUTILIZADA DA PÁGINA FINANCEIRA)
const applyFiltersToQuery = (query, currentFilters) => {
    if (currentFilters.searchTerm) query = query.ilike('descricao', `%${currentFilters.searchTerm}%`);
    if (currentFilters.startDate) query = query.gte('data_transacao', currentFilters.startDate);
    if (currentFilters.endDate) query = query.lte('data_transacao', currentFilters.endDate);
    if (currentFilters.empresaIds?.length > 0) query = query.in('empresa_id', currentFilters.empresaIds);
    if (currentFilters.contaIds?.length > 0) query = query.in('conta_id', currentFilters.contaIds);
    if (currentFilters.categoriaIds?.length > 0) query = query.in('categoria_id', currentFilters.categoriaIds);
    if (currentFilters.empreendimentoIds?.length > 0) query = query.in('empreendimento_id', currentFilters.empreendimentoIds);
    if (currentFilters.favorecidoId) query = query.eq('favorecido_contato_id', currentFilters.favorecidoId);
    if (currentFilters.tipo?.length > 0 && currentFilters.tipo[0] !== '') {
        query = query.in('tipo', Array.isArray(currentFilters.tipo) ? currentFilters.tipo : [currentFilters.tipo]);
    }
    return query;
};


// Função para calcular o resultado do KPI com base nos filtros
async function calculateKpiResult({ queryKey }) {
    const [_key, filters] = queryKey;
    let query = supabase.from('lancamentos').select('valor, tipo');
    query = applyFiltersToQuery(query, filters);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

// =================================
// COMPONENTE DA PÁGINA
// =================================

export default function ConstrutorKpiPage() {
    const queryClient = useQueryClient();
    const router = useRouter();

    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [tipoCalculo, setTipoCalculo] = useState('resultado');

    const [filters, setFilters] = useState({
        searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [],
        status: [], tipo: [], startDate: '', endDate: new Date().toISOString().split('T')[0],
        favorecidoId: null
    });

    // Busca as opções para os filtros
    const { data: filterOptions, isLoading: isLoadingOptions } = useQuery({
        queryKey: ['financeFilterOptions'],
        queryFn: fetchFilterOptions,
    });

    // Calcula o resultado do KPI em tempo real
    const { data: kpiRawData, isLoading: isLoadingKpiResult } = useQuery({
        queryKey: ['kpiBuilderResult', filters],
        queryFn: calculateKpiResult,
        enabled: !isLoadingOptions, // Só roda depois que as opções de filtro carregarem
    });
    
    // Formata o resultado do KPI para exibição
    const kpiResult = useMemo(() => {
        if (!kpiRawData) return { total: 0, label: 'Carregando...' };

        const receitas = kpiRawData.filter(l => l.tipo === 'Receita').reduce((acc, l) => acc + l.valor, 0);
        const despesas = kpiRawData.filter(l => l.tipo === 'Despesa').reduce((acc, l) => acc + l.valor, 0);
        
        switch (tipoCalculo) {
            case 'receitas': return { total: receitas, label: 'Total de Receitas' };
            case 'despesas': return { total: despesas, label: 'Total de Despesas' };
            case 'resultado': return { total: receitas - despesas, label: 'Resultado' };
            case 'contagem': return { total: kpiRawData.length, label: 'Nº de Lançamentos' };
            default: return { total: 0, label: '...' };
        }
    }, [kpiRawData, tipoCalculo]);


    // Mutation para salvar o KPI
    const { mutate: saveKpi, isPending } = useMutation({
        mutationFn: async () => {
            if (!titulo) throw new Error("O título é obrigatório.");
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuário não autenticado.");

            const { error } = await supabase.from('kpis_personalizados').insert([{
                usuario_id: user.id,
                titulo,
                descricao,
                modulo: 'financeiro',
                tipo_calculo: tipoCalculo,
                filtros: filters,
            }]);

            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            toast.success('KPI criado com sucesso!');
            router.push('/painel'); // ou para a lista de KPIs
        },
        onError: (error) => {
            toast.error(`Erro ao salvar KPI: ${error.message}`);
        }
    });

    if (isLoadingOptions) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando construtor...</div>;
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-2 text-gray-800">Construtor de KPIs</h1>
                <p className="text-gray-600">Use os filtros para definir seu indicador, dê um nome e salve no seu painel.</p>
            </div>
            
            <FiltroFinanceiro
                filters={filters}
                setFilters={setFilters}
                {...filterOptions}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Lado Esquerdo: Pré-visualização e Cálculo */}
                <div className="bg-white p-6 rounded-lg shadow-md border space-y-4">
                    <h2 className="text-xl font-bold text-gray-700">Pré-visualização</h2>
                    <div>
                        <label className="text-sm font-medium text-gray-700">O que calcular com esses filtros?</label>
                        <select 
                            value={tipoCalculo} 
                            onChange={e => setTipoCalculo(e.target.value)}
                            className="w-full p-2 mt-1 border rounded-md"
                        >
                            <option value="resultado">Resultado (Receitas - Despesas)</option>
                            <option value="receitas">Apenas Receitas</option>
                            <option value="despesas">Apenas Despesas</option>
                            <option value="contagem">Nº de Lançamentos</option>
                        </select>
                    </div>
                    <div className="pt-4">
                        {isLoadingKpiResult ? (
                            <div className="text-center"><FontAwesomeIcon icon={faSpinner} spin /> Calculando...</div>
                        ) : (
                            <KpiCard
                                title={kpiResult.label}
                                value={kpiResult.label === 'Nº de Lançamentos' ? kpiResult.total : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiResult.total)}
                                color={kpiResult.total >= 0 ? 'text-blue-500' : 'text-red-500'}
                            />
                        )}
                    </div>
                </div>

                {/* Lado Direito: Salvar o KPI */}
                <div className="bg-white p-6 rounded-lg shadow-md border space-y-4">
                    <h2 className="text-xl font-bold text-gray-700">Salvar KPI</h2>
                    <div>
                        <label htmlFor="titulo" className="block text-sm font-medium text-gray-700">Título para o KPI</label>
                        <input type="text" id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required placeholder="Ex: Despesas com Obras (Mês Atual)" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="descricao" className="block text-sm font-medium text-gray-700">Descrição (Opcional)</label>
                        <textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows="3" placeholder="Uma breve explicação do que este indicador mede." className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"></textarea>
                    </div>
                     <div className="text-right pt-4">
                        <button 
                            onClick={saveKpi} 
                            disabled={isPending || !titulo}
                            className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center"
                        >
                            <FontAwesomeIcon icon={isPending ? faSpinner : faSave} spin={isPending} className="mr-2" />
                            {isPending ? 'Salvando...' : 'Salvar e Adicionar ao Painel'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}