"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../../../utils/supabase/client';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import ProdutoList from '../../../../../components/ProdutoList';
import CondicoesPagamento from '../../../../../components/CondicoesPagamento';
import TabelaVenda from '../../../../../components/TabelaVenda';
import Accordion from '../../../../../components/Accordion'; // Importando o novo componente
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function ProdutosPage() {
    const supabase = createClient();
    const params = useParams();
    const { id: empreendimentoId } = params;

    const [empreendimento, setEmpreendimento] = useState(null);
    const [produtos, setProdutos] = useState([]);
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        
        const { data: empreendimentoData, error: empreendimentoError } = await supabase.from('empreendimentos').select('nome').eq('id', empreendimentoId).single();
        if (empreendimentoError) return notFound();
        setEmpreendimento(empreendimentoData);

        const { data: produtosData } = await supabase.from('produtos_empreendimento').select('*').eq('empreendimento_id', empreendimentoId).order('unidade');
        setProdutos(produtosData || []);
        
        const { data: configData } = await supabase.from('configuracoes_venda').select('*, parcelas_adicionais(*)').eq('empreendimento_id', empreendimentoId).maybeSingle();
        setConfig(configData || { empreendimento_id: empreendimentoId, parcelas_adicionais: [] });
        
        setLoading(false);
    }, [supabase, empreendimentoId]);

    useEffect(() => { if (empreendimentoId) fetchData(); }, [empreendimentoId, fetchData]);

    if (loading || !empreendimento) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
    }

    return (
        <div className="space-y-6">
            <Link href="/empreendimentos" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para a Lista de Empreendimentos
            </Link>
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">
                    Comercialização de: <span className="text-blue-600">{empreendimento.nome}</span>
                </h1>
            </div>
            
            <Accordion title="1. Produtos e Preços" startOpen={true}>
                <ProdutoList 
                    initialProdutos={produtos} 
                    empreendimentoId={empreendimentoId} 
                    initialConfig={config}
                    onUpdate={fetchData} 
                />
            </Accordion>

            <Accordion title="2. Condições de Pagamento" startOpen={true}>
                <CondicoesPagamento
                    empreendimentoId={empreendimentoId}
                    initialConfig={config}
                    onUpdate={fetchData} 
                />
            </Accordion>
            
            <Accordion title="3. Tabela de Venda (Simulação)" startOpen={true}>
                <TabelaVenda 
                    produtos={produtos}
                    config={config}
                    parcelasAdicionais={config.parcelas_adicionais || []}
                />
            </Accordion>
        </div>
    );
}