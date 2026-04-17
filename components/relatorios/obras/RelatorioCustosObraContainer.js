// components/relatorios/obras/RelatorioCustosObraContainer.js
"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useCustosObraDRE } from '@/hooks/obras/useCustosObraDRE';
import FiltroFinanceiro from '@/components/financeiro/FiltroFinanceiro';
import FinanceiroObrasDRE from '@/components/relatorios/obras/FinanceiroObrasDRE';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter } from '@fortawesome/free-solid-svg-icons';

// AuxData reutilize o cache da organizacao
async function fetchAuxiliaryData(organizacao_id) {
    const supabase = createClient();
    if (!organizacao_id) return { empresas: [], contas: [], categorias: [], empreendimentos: [], allContacts: [] };

    const [empresasRes, contasRes, categoriasRes, empreendimentosRes, contatosRes] = await Promise.all([
        supabase.from('cadastro_empresa').select('*').eq('organizacao_id', organizacao_id).order('nome_fantasia'),
        supabase.from('contas_financeiras').select('*').eq('organizacao_id', organizacao_id).order('nome'),
        supabase.from('categorias_financeiras').select('*').in('organizacao_id', [organizacao_id, 1]).order('nome'),
        supabase.from('empreendimentos').select('*').eq('organizacao_id', organizacao_id).order('nome'),
        supabase.from('contatos').select('id, nome, razao_social').eq('organizacao_id', organizacao_id).order('nome')
    ]);

    return {
        empresas: empresasRes.data || [],
        contas: contasRes.data || [],
        categorias: categoriasRes.data || [],
        empreendimentos: empreendimentosRes.data || [],
        allContacts: contatosRes.data || []
    };
}

export default function RelatorioCustosObraContainer() {
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [mostrarFiltros, setMostrarFiltros] = useState(false);

    const [filtrosAvancados, setFiltrosAvancados] = useState({
        empresaIds: [],
        contaIds: [],
        categoriaIds: [],
        empreendimentoIds: [],
        status: [],
        tipo: ['Despesa'],
        favorecidoId: null,
        searchTerm: '',
        startDate: '',
        endDate: '',
        useCompetencia: false
    });

    const { data: auxData } = useQuery({
        queryKey: ['financeiro_aux_data_dre', organizacaoId],
        queryFn: () => fetchAuxiliaryData(organizacaoId),
        enabled: !!organizacaoId,
        staleTime: 300000
    });

    // Filtros injetados no Hook de Matriz
    // Busca todo o histórico por padrão, a não ser que o usuário filtre uma data no funil avançado.
    const filtrosHook = useMemo(() => {
        return {
            organizacaoId: organizacaoId,
            ...filtrosAvancados,
        };
    }, [organizacaoId, filtrosAvancados]);

    const { dadosDRE, isLoading } = useCustosObraDRE(filtrosHook);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* === HEADER E NAVEGAÇÃO === */}
            <div className="flex flex-col gap-4 print:hidden">
                <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 px-2">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
                        Demonstração de Custos da Obra
                    </h2>

                    <div className="flex gap-2 items-center flex-wrap justify-end">
                        <select 
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 w-full sm:w-auto max-w-[250px] truncate shadow-sm cursor-pointer"
                            value={filtrosAvancados.empreendimentoIds[0] || ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFiltrosAvancados(prev => ({
                                    ...prev,
                                    empreendimentoIds: val ? [val] : []
                                }));
                            }}
                        >
                            <option value="">Todas as Obras / Corporativo</option>
                            {auxData?.empreendimentos?.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.nome}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setMostrarFiltros(!mostrarFiltros)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border ${mostrarFiltros ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <FontAwesomeIcon icon={faFilter} />
                            Filtros {filtrosAvancados.empreendimentoIds.length > 0 ? '(Ativos)' : ''}
                        </button>
                    </div>
                </div>

                {/* FILTROS AVANÇADOS */}
                {mostrarFiltros && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 animate-slide-down">
                        <FiltroFinanceiro
                            filters={filtrosAvancados}
                            setFilters={setFiltrosAvancados}
                            empresas={auxData?.empresas || []}
                            contas={auxData?.contas || []}
                            categorias={auxData?.categorias || []}
                            empreendimentos={auxData?.empreendimentos || []}
                            allContacts={auxData?.allContacts || []}
                        />
                    </div>
                )}
            </div>

            {/* TABELA MATRIZ (SCROLLABLE HTML) */}
            <FinanceiroObrasDRE dadosDRE={dadosDRE} isLoading={isLoading} />
        </div>
    );
}
