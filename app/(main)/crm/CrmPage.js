// app/(main)/crm/CrmPage.js
"use client";

import { useState } from 'react';
import WhatsAppChatManager from '@/components/WhatsAppChatManager';

// Placeholder para o futuro componente do Funil
const FunilDeVendas = () => (
    <div className="p-6 bg-white rounded-lg shadow-md h-full">
        <h2 className="text-2xl font-bold text-gray-800">Funil de Vendas</h2>
        <p className="mt-2 text-gray-600">Em breve, o seu funil de vendas Kanban ficará aqui. Estamos preparando tudo!</p>
    </div>
);

export default function CrmPage({ contatos, user }) {
    const [activeTab, setActiveTab] = useState('whatsapp'); // 'whatsapp' ou 'funil'

    const tabStyle = "px-6 py-2 font-semibold rounded-t-lg transition-colors duration-200";
    const activeTabStyle = "bg-white text-blue-600 shadow-sm";
    const inactiveTabStyle = "bg-gray-200 text-gray-600 hover:bg-gray-300";

    return (
        <div className="h-full flex flex-col">
            {/* Navegação das Abas */}
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
                    // O componente de chat que já existia
                    <WhatsAppChatManager contatos={contatos} />
                )}
                {activeTab === 'funil' && (
                    // O placeholder para nosso futuro funil
                    <FunilDeVendas />
                )}
            </div>
        </div>
    );
}