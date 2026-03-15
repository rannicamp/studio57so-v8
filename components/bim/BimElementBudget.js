'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBimMapeamentos } from '@/hooks/bim/useBimMapeamentos';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationCircle, faBolt } from '@fortawesome/free-solid-svg-icons';

// Auxiliar para a fórmula
const parseFormula = (fatorStr, valorBruto) => {
    if (!fatorStr) return valorBruto;
    try {
        const expressao = fatorStr.replace(/,/g, '.').replace(/\[quantidade\]|\[q\]/gi, valorBruto.toString());
        // eslint-disable-next-line no-new-func
        const fn = new Function('return ' + expressao);
        const resultado = fn();
        return typeof resultado === 'number' && !isNaN(resultado) ? resultado : valorBruto;
    } catch (e) { return valorBruto; }
};

export default function BimElementBudget({ selectedIds = [], projetoBimId }) {
    const supabase = createClient();
    const { organizacao_id } = useAuth();
    
    // 1. Busca mapeamentos da Organização
    const { resolverMapeamento, carregandoMapeamentos } = useBimMapeamentos({ organizacaoId: organizacao_id });

    // 2. Busca OS ITENS CONSOLIDADOS (Tabela orcamento_itens) -> Atrasado/Geral
    const { data: budgetItems, isLoading: loadingBudget, error } = useQuery({
        queryKey: ['bimBudgetItems', projetoBimId, selectedIds],
        queryFn: async () => {
            if (!projetoBimId || selectedIds.length === 0) return [];
            const { data, error } = await supabase
                .from('orcamento_itens')
                .select(`id, descricao, unidade, quantidade, preco_unitario, custo_total, categoria`)
                .eq('bim_projeto_id', projetoBimId)
                .overlaps('bim_elemento_ids', selectedIds);

            if (error) throw error;
            return data || [];
        },
        enabled: !!projetoBimId && selectedIds.length > 0,
        staleTime: 2 * 60 * 1000 // 2 min
    });

    // 3. BUSCA DOS PRÓPRIOS ELEMENTOS E SUAS PROPRIEDADES (para as Injeções Live)
    // O React Query provavelmente devolverá em MS já que isso foi cacheado no `BimProperties.js`
    const { data: elementos, isLoading: loadingElementos } = useQuery({
        queryKey: ['bimElementProperties', selectedIds],
        queryFn: async () => {
            if (!selectedIds || selectedIds.length === 0 || !organizacao_id) return [];
            const { data, error } = await supabase
                .from('elementos_bim')
                .select('*')
                .eq('organizacao_id', organizacao_id)
                .in('external_id', selectedIds);
            if (error) throw error;
            return data || [];
        },
        enabled: selectedIds.length > 0 && !!organizacao_id,
        staleTime: 1000 * 60 * 5, 
    });

    // 4. CRIAÇÃO DOS ITENS "EM TEMPO REAL" DAS PROPRIEDADES!
    const liveItems = useMemo(() => {
        if (!elementos || elementos.length === 0 || !resolverMapeamento) return [];
        const itemsGerados = [];
        
        elementos.forEach(el => {
            const propsKeys = Object.keys(el.propriedades || {});
            propsKeys.forEach(k => {
                const mapResult = resolverMapeamento(el, k);
                if (mapResult) {
                     const valNum = parseFloat(el.propriedades[k] || 0);
                     if (valNum > 0) {
                         const objMat = mapResult.material || mapResult.sinapi;
                         const precoUnit = objMat?.preco_unitario || 0;
                         const qtdFinal = parseFormula(mapResult.fator_conversao, valNum);
                         
                         const itemKey = `live_${mapResult.id}`;
                         const existing = itemsGerados.find(i => i.id === itemKey);
                         if (existing) {
                             existing.quantidade += qtdFinal;
                             existing.custo_total += (qtdFinal * precoUnit);
                         } else {
                             itemsGerados.push({
                                 id: itemKey,
                                 descricao: objMat?.nome || 'Insumo Desconhecido',
                                 unidade: mapResult.unidade_override || objMat?.unidade_medida || 'un',
                                 quantidade: qtdFinal,
                                 preco_unitario: precoUnit,
                                 custo_total: qtdFinal * precoUnit,
                                 categoria: mapResult.material ? 'Próprio' : 'SINAPI',
                                 isLive: true
                             });
                         }
                     }
                }
            });
        });
        return itemsGerados;
    }, [elementos, resolverMapeamento]);

    const formatarMoeda = (valor) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
    };

    const isLoadingTodos = loadingBudget || loadingElementos || carregandoMapeamentos;

    if (isLoadingTodos) {
        return (
            <div className="flex items-center justify-center p-3 text-gray-400">
                <FontAwesomeIcon icon={faSpinner} spin className="mr-2 text-[10px]" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Calculando...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center p-2 text-red-500 bg-red-50/50 rounded text-[9px] font-bold">
                <FontAwesomeIcon icon={faExclamationCircle} className="mr-1" /> Falha ao acessar custos.
            </div>
        );
    }

    // Se n tiver consolidados e n tiver lives = vazio.
    const temConsolidados = budgetItems && budgetItems.length > 0;
    const temLives = liveItems && liveItems.length > 0;

    if (!temConsolidados && !temLives) {
        return (
            <div className="p-2 text-center text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                Nenhum material vinculado
            </div>
        );
    }

    // Usaremos preferencialmente o consolidado para exibição
    const itemsToShow = temConsolidados ? budgetItems : liveItems;
    const isLiveMode = !temConsolidados;

    return (
        <div className="p-1 space-y-1">
            {itemsToShow.map((item) => (
                <div key={item.id} className="bg-white border text-left border-gray-100 rounded flex flex-col hover:border-blue-200 transition-colors p-1.5 shadow-sm">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-gray-700 leading-tight">
                            {isLiveMode && <FontAwesomeIcon icon={faBolt} className="text-gray-400 mr-1 text-[8px]" title="Tempo Real" />}
                            {item.descricao}
                        </span>
                        <span className="text-[8px] px-1 py-0.5 rounded bg-gray-50 text-gray-500 font-bold ml-2 shrink-0 border border-gray-100 uppercase tracking-widest">
                            {item.categoria || 'Geral'}
                        </span>
                    </div>
                    
                    <div className="flex items-end justify-between mt-1">
                        <div className="text-[9px] text-gray-400">
                            <span className="font-bold text-gray-600">{item.quantidade.toFixed(2)}</span> {item.unidade}
                            <span className="mx-1 opacity-50">•</span>
                            {formatarMoeda(item.preco_unitario)}/un
                        </div>
                        <div className="text-[10px] font-black text-gray-800 tracking-tight">
                            {formatarMoeda(item.custo_total)}
                        </div>
                    </div>
                </div>
            ))}

            {/* Resumo FOOTER se houver mais de um item */}
            {itemsToShow.length > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 pt-1 mt-1 px-1">
                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
                        {isLiveMode ? 'Estimativa' : 'Orçado'}
                    </span>
                    <span className="text-[10px] font-black text-blue-800">
                        {formatarMoeda(itemsToShow.reduce((acc, curr) => acc + (parseFloat(curr.custo_total) || 0), 0))}
                    </span>
                </div>
            )}
        </div>
    );
}
