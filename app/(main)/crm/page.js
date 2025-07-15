// app/(main)/crm/page.js

"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import WhatsAppChatManager from '@/components/WhatsAppChatManager';
import FunilManager from '@/components/crm/FunilManager'; // Importa nosso novo componente

export default function CrmPage() {
    const { setPageTitle } = useLayout();
    const [activeTab, setActiveTab] = useState('funil'); // Inicia na aba do Funil
    const [contatos, setContatos] = useState([]);
    const [loadingContatos, setLoadingContatos] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        setPageTitle("CRM"); // Atualiza o título da página no Header
        
        const fetchContatos = async () => {
            setLoadingContatos(true);
            const { data, error } = await supabase
                .from('contatos')
                .select(`*, telefones (id, telefone, tipo)`);

            if (error) {
                console.error("Erro ao buscar contatos:", error);
            } else {
                setContatos(data || []);
            }
            setLoadingContatos(false);
        };
        fetchContatos();
    }, [supabase, setPageTitle]);

    const tabStyle = "px-6 py-2 font-semibold rounded-t-lg transition-colors duration-200";
    const activeTabStyle = "bg-white text-blue-600 shadow-sm";
    const inactiveTabStyle = "bg-gray-200 text-gray-600 hover:bg-gray-300";

    return (
        <div className="h-full flex flex-col">
            {/* Navegação das Abas (Corrigido o typo 'WhatsAppApp') */}
            <div className="flex border-b border-gray-200 bg-gray-100">
                <button
                    onClick={() => setActiveTab('whatsapp')}
                    className={`${tabStyle} ${activeTab === 'whatsapp' ? activeTabStyle : inactiveTabStyle}`}
                >
                    WhatsApp
                </button>
                <button
                    onClick={() => setActiveTab('funil')}
                    className={`${tabStyle} ${activeTab === 'funil' ? activeTabStyle : inactiveTabStyle}`}
                >
                    Funil de Vendas
                </button>
            </div>

            {/* Conteúdo das Abas */}
            <div className="flex-grow bg-gray-100 pt-1">
                {activeTab === 'whatsapp' && (
                    loadingContatos 
                        ? <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin /> Carregando contatos...</div> 
                        : <WhatsAppChatManager contatos={contatos} />
                )}
                {activeTab === 'funil' && (
                    // Aqui entra nosso novo componente
                    <FunilManager />
                )}
            </div>
        </div>
    );
}