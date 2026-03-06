// components/relatorios/financeiro/RelatorioDREContainer.js
"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useRelatorioDRE } from '@/hooks/financeiro/useRelatorioDRE';
import FiltroFinanceiro from '@/components/financeiro/FiltroFinanceiro';
import FinanceiroDRE from '@/components/relatorios/financeiro/FinanceiroDRE';
import {
    startOfMonth, endOfMonth, format, addMonths, subMonths, isSameMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronLeft, faChevronRight, faCalendarAlt, faFilter
} from '@fortawesome/free-solid-svg-icons';

// Função para buscar dados auxiliares (Categorias, Contas, etc.) - Igual a do Dashboard
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

export default function RelatorioDREContainer() {
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [dataBase, setDataBase] = useState(new Date());
    const [mostrarFiltros, setMostrarFiltros] = useState(false);

    const [filtrosAvancados, setFiltrosAvancados] = useState({
        empresaIds: [],
        contaIds: [],
        categoriaIds: [],
        empreendimentoIds: [],
        status: [],
        tipo: [],
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

    const menuMeses = useMemo(() => {
        const meses = [];
        for (let i = -2; i <= 2; i++) { meses.push(addMonths(dataBase, i)); }
        return meses;
    }, [dataBase]);

    const filtrosHook = useMemo(() => {
        const temDataEspecifica = filtrosAvancados.startDate && filtrosAvancados.endDate;
        return {
            organizacaoId: organizacaoId,
            ...filtrosAvancados,
            startDate: temDataEspecifica ? filtrosAvancados.startDate : startOfMonth(dataBase),
            endDate: temDataEspecifica ? filtrosAvancados.endDate : endOfMonth(dataBase),
        };
    }, [dataBase, organizacaoId, filtrosAvancados]);

    // O Hook Estrela com a contabilidade do DRE
    const { dadosDRE, isLoading } = useRelatorioDRE(filtrosHook);

    const navegarMes = (mes) => setDataBase(mes);
    const proximoMes = () => navegarMes(addMonths(dataBase, 1));
    const anteriorMes = () => navegarMes(subMonths(dataBase, 1));
    const irParaHoje = () => {
        setDataBase(new Date());
        setFiltrosAvancados(prev => ({ ...prev, startDate: '', endDate: '' }));
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* === HEADER E NAVEGAÇÃO === */}
            <div className="flex flex-col gap-4 print:hidden">
                <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 px-2">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
                        Demonstração de Resultados (DRE)
                    </h2>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setMostrarFiltros(!mostrarFiltros)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border ${mostrarFiltros ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <FontAwesomeIcon icon={faFilter} />
                            Filtros {filtrosAvancados.status.length > 0 ? '(Ativos)' : ''}
                        </button>
                        <button
                            onClick={irParaHoje}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faCalendarAlt} /> Hoje
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

                {/* CARROSSEL */}
                {(!filtrosAvancados.startDate || !filtrosAvancados.endDate) ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1 flex items-center justify-between">
                        <button onClick={anteriorMes} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <div className="flex-1 flex justify-around items-center overflow-hidden gap-1">
                            {menuMeses.map((mes, index) => {
                                const isSelected = isSameMonth(mes, dataBase);
                                const hiddenOnMobile = index === 0 || index === 4 ? 'hidden sm:block' : '';
                                return (
                                    <button
                                        key={mes.toString()}
                                        onClick={() => navegarMes(mes)}
                                        className={`${hiddenOnMobile} flex flex-col items-center justify-center px-4 py-2 rounded-lg transition-all ${isSelected ? 'bg-indigo-50 text-indigo-700 scale-105 border border-indigo-100' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        <span className="text-xs font-semibold uppercase">{format(mes, 'yyyy', { locale: ptBR })}</span>
                                        <span className="text-sm font-bold capitalize">{format(mes, 'MMMM', { locale: ptBR })}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={proximoMes} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </div>
                ) : (
                    <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg text-center text-indigo-700 text-sm font-medium flex justify-center items-center gap-2">
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        Visualizando Período Personalizado
                        <button onClick={() => setFiltrosAvancados(prev => ({ ...prev, startDate: '', endDate: '' }))} className="ml-2 underline hover:text-indigo-900">
                            (Voltar para Mensal)
                        </button>
                    </div>
                )}
            </div>

            {/* TABELA CONTÁBIL DO DRE */}
            <FinanceiroDRE dadosDRE={dadosDRE} isLoading={isLoading} />
        </div>
    );
}
