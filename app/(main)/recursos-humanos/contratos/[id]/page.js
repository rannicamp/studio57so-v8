// app/(main)/recursos-humanos/contratos/[id]/page.js
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faBuilding, faSpinner } from '@fortawesome/free-solid-svg-icons';

// --- IMPORTAÇÕES DOS MÓDULOS ---
import ContratoGeral from '@/components/rh/contratos/ContratoGeral';
import ContratoDocumentos from '@/components/rh/contratos/ContratoDocumentos';
import ContratoFinanceiro from '@/components/rh/contratos/ContratoFinanceiro';

export default function DetalhesContratoPage() {
    const { id } = useParams();
    const router = useRouter();
    const supabase = createClient();
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [contrato, setContrato] = useState(null);
    
    // --- LÓGICA DE PERSISTÊNCIA DA ABA ---
    const STORAGE_KEY = `STUDIO57_TAB_CONTRATO_${id}`;
    
    // Inicia com 'geral', mas o useEffect abaixo vai corrigir se tiver histórico
    const [activeTab, setActiveTab] = useState('geral');

    // 1. Restaurar aba salva ao carregar a página
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedTab = localStorage.getItem(STORAGE_KEY);
            if (savedTab) {
                setActiveTab(savedTab);
            }
        }
    }, [id, STORAGE_KEY]);

    // 2. Função para trocar a aba e salvar na memória
    const handleTabChange = (tabName) => {
        setActiveTab(tabName);
        localStorage.setItem(STORAGE_KEY, tabName);
    };

    // --- CARREGAMENTO DE DADOS ---
    useEffect(() => {
        if (id && user?.organizacao_id) {
            fetchContrato();
        }
    }, [id, user?.organizacao_id]);

    const fetchContrato = async () => {
        try {
            const { data, error } = await supabase
                .from('contratos_terceirizados')
                .select(`
                    *,
                    fornecedor:contatos(id, nome, razao_social, cnpj, cpf, foto_url)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setContrato(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
                <span className="ml-4 text-lg">Carregando contrato...</span>
            </div>
        );
    }

    if (!contrato) return <div className="p-10 text-center text-red-500">Contrato não encontrado.</div>;

    const fornecedorNome = contrato.fornecedor?.nome || contrato.fornecedor?.razao_social;

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header / Voltar */}
            <div className="flex justify-between items-center">
                <button 
                    onClick={() => router.back()} 
                    className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
                >
                    <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
                    Voltar
                </button>
            </div>

            {/* Container Principal (Card Branco Único - Estilo Padrão) */}
            <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
                
                {/* Info do Contrato (Topo) */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-100 pb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            {contrato.titulo}
                        </h1>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-2">
                            <span className="flex items-center gap-1 font-medium bg-gray-100 px-2 py-1 rounded text-gray-700">
                                <FontAwesomeIcon icon={faBuilding} className="text-gray-400"/>
                                {fornecedorNome}
                            </span>
                            {contrato.fornecedor?.cnpj && <span>CNPJ: {contrato.fornecedor.cnpj}</span>}
                        </div>
                    </div>
                    <div className="mt-4 md:mt-0">
                        <span className={`px-4 py-1.5 rounded-full text-sm font-bold border flex items-center gap-2 ${
                            contrato.status === 'Ativo' ? 'bg-green-50 text-green-700 border-green-200' : 
                            contrato.status === 'Encerrado' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                            'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${
                                contrato.status === 'Ativo' ? 'bg-green-500' : 
                                contrato.status === 'Encerrado' ? 'bg-gray-500' : 'bg-yellow-500'
                            }`}></div>
                            {contrato.status}
                        </span>
                    </div>
                </div>

                {/* Abas com Persistência */}
                <div className="flex border-b border-gray-200 mb-6">
                    {['geral', 'documentos', 'financeiro'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => handleTabChange(tab)} // Usa a nova função de troca
                            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors capitalize ${
                                activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab === 'geral' ? 'Visão Geral' : tab}
                        </button>
                    ))}
                </div>

                {/* Renderização dos Componentes Filhos */}
                <div className="min-h-[400px]">
                    {activeTab === 'geral' && (
                        <ContratoGeral contrato={contrato} onUpdate={fetchContrato} />
                    )}
                    {activeTab === 'documentos' && (
                        <ContratoDocumentos contratoId={contrato.id} />
                    )}
                    {activeTab === 'financeiro' && (
                        <ContratoFinanceiro contrato={contrato} />
                    )}
                </div>
            </div>
        </div>
    );
}