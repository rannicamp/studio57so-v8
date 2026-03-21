'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import TabelaVenda from '@/components/TabelaVenda';

export default function TabelaVendaCorretorAba({ empreendimentoId, organizacaoId }) {
    const supabase = createClient();
    const [filtroStatus, setFiltroStatus] = useState('');

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['tabelaRicaCorretor', empreendimentoId, organizacaoId],
        queryFn: async () => {
            // 1. O próprio empreendimento (para propriedades como logo_url, proprietaria)
            const { data: emp, error: errEmp } = await supabase
                .from('empreendimentos')
                .select('*, proprietaria:empresa_proprietaria_id(*)')
                .eq('id', empreendimentoId)
                .single();
            if (errEmp) throw new Error(errEmp.message);

            // 2. Configurações Financeiras da Tabela (Percentuais e Parâmetros)
            const { data: config, error: errC } = await supabase
                .from('configuracoes_venda')
                .select('*')
                .eq('empreendimento_id', empreendimentoId)
                .eq('organizacao_id', organizacaoId)
                .maybeSingle();

            // 3. As Unidades em si (Produtos) dessa Org
            const { data: produtos, error: errProd } = await supabase
                .from('produtos_empreendimento')
                .select('*')
                .eq('empreendimento_id', empreendimentoId)
                .eq('organizacao_id', organizacaoId)
                .order('unidade', { ascending: true });
            
            if (errProd) throw new Error(errProd.message);
            
            const resolvedConfig = config || {};

            return {
                empreendimento: emp,
                configuracoes: resolvedConfig,
                parcelasAdicionais: resolvedConfig.parcelas_adicionais || [],
                produtos: produtos || []
            }
        },
        enabled: !!empreendimentoId && !!organizacaoId
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg shadow-sm border mt-4">
                <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-4xl mb-4" />
                <p className="text-gray-500 font-medium tracking-wide">Gerando a rica matemática das tabelas...</p>
            </div>
        );
    }

    if (isError) {
        return (
             <div className="bg-red-50 text-red-600 p-6 rounded-lg border border-red-200 mt-4 text-center">
                <strong>Erro ao buscar dados do parcelamento:</strong> {error.message}
             </div>
        );
    }

    if (!data) return null;

    // Aplicação da regra de Abas: o corretor visualiza status livremente.
    const produtosFiltrados = filtroStatus 
        ? data.produtos.filter(p => (p.status || 'Disponível').trim().toLowerCase() === filtroStatus.trim().toLowerCase()) 
        : data.produtos;

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Secção de Filtros (Apenas Disponibilidade da Tabela) */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-center justify-start gap-4 no-print">
                <div className="w-full md:w-64 relative">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Exibir Unidades</label>
                    <select 
                        value={filtroStatus} 
                        onChange={(e) => setFiltroStatus(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold text-gray-700 outline-none"
                    >
                        <option value="">Todas as Unidades</option>
                        <option value="disponível">Apenas Disponíveis</option>
                        <option value="reservado">Apenas Reservadas</option>
                        <option value="vendido">Apenas Vendidas</option>
                    </select>
                </div>
            </div>

            {produtosFiltrados.length === 0 ? (
                 <div className="bg-white p-12 text-center rounded-lg border shadow-sm mt-4 no-print">
                    <h3 className="text-xl font-bold text-gray-700">Nenhuma unidade compatível com o filtro</h3>
                    <p className="text-gray-500 mt-2">Escolha uma aba diferente ou troque a opção no menu de unidades.</p>
                 </div>
            ) : (
                <div className="mt-2">
                    {/* Renderizamos A MESMA TABELA COMPLETA COM PDF que está no Painel de Controle */}
                    <TabelaVenda 
                        produtos={produtosFiltrados} 
                        config={data.configuracoes} 
                        parcelasAdicionais={data.parcelasAdicionais} 
                        empreendimento={data.empreendimento} 
                    />
                </div>
            )}
        </div>
    );
}
