"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation'; // Importa o notFound
import { createClient } from '../../../../utils/supabase/client';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import FichaContrato from '../../../../components/contratos/FichaContrato';
import CronogramaFinanceiro from '../../../../components/contratos/CronogramaFinanceiro';
import ContratoAnexos from '../../../../components/contratos/ContratoAnexos';
import ParcelasPagas from '../../../../components/contratos/ParcelasPagas';

export default function ContratoPage() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();
    
    const [contrato, setContrato] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('ficha');

    const fetchContratoData = useCallback(async () => {
        if (!params.id) return;
        setLoading(true);
        
        const { data, error } = await supabase
            .from('contratos')
            .select(`
                *,
                contato:contato_id (*),
                corretor:corretor_id (*), 
                produto:produto_id (*),
                empreendimento:empreendimento_id (nome),
                contrato_parcelas (*),
                contrato_permutas (*),
                simulacao:simulacao_id (*) 
            `)
            .eq('id', params.id)
            .maybeSingle();

        if (error) {
            console.error("Erro ao buscar dados do contrato:", error);
            setError('Não foi possível carregar os dados do contrato.');
            setLoading(false);
        } else if (!data) {
            // Se nenhum dado for retornado, chama a página de erro 404
            setLoading(false);
            notFound();
        } else {
            if (data.contrato_parcelas) {
                data.contrato_parcelas.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
            }
            setContrato(data);
            setLoading(false);
        }
    }, [params.id, supabase]);

    useEffect(() => {
        fetchContratoData();
    }, [fetchContratoData]);

    // O restante do arquivo permanece igual...

    const TabButton = ({ tabName, label, icon }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tabName
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
            <FontAwesomeIcon icon={icon} />
            {label}
        </button>
    );

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" />
                <p className="mt-2">Carregando dados do contrato...</p>
            </div>
        );
    }
    
    // Este erro só será exibido se a busca falhar, não se o contrato não for encontrado.
    if (error) {
        return <p className="text-center text-red-500 p-10">{error}</p>;
    }
    
    // Se o contrato for null (pouco provável de acontecer com a lógica acima, mas é uma segurança extra),
    // ele já terá sido redirecionado para a página 404.
    if (!contrato) return null;


    return (
        <div className="space-y-6">
            <Link href="/contratos" className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-2 font-semibold">
                <FontAwesomeIcon icon={faArrowLeft} />
                Voltar para Lista de Contratos
            </Link>
            
             <div className="bg-white shadow-md rounded-lg">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-4 px-4">
                        <TabButton tabName="ficha" label="Ficha do Contrato" />
                        <TabButton tabName="cronograma" label="Cronograma Financeiro" />
                        <TabButton tabName="pagas" label="Parcelas Pagas" />
                        <TabButton tabName="documentos" label="Documentos" />
                    </nav>
                </div>
                
                <div className="p-4">
                    {activeTab === 'ficha' && <FichaContrato initialContratoData={contrato} onUpdate={fetchContratoData} />}
                    {activeTab === 'cronograma' && (
                        <CronogramaFinanceiro
                            contratoId={contrato.id}
                            parcelas={contrato.contrato_parcelas}
                            permutas={contrato.contrato_permutas}
                            valorTotalContrato={contrato.valor_final_venda}
                            onUpdate={fetchContratoData}
                        />
                    )}
                    {activeTab === 'pagas' && <ParcelasPagas contatoId={contrato.contato.id} />}
                    {activeTab === 'documentos' && (
                        <ContratoAnexos
                            contratoId={contrato.id}
                            onUpdate={fetchContratoData}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}