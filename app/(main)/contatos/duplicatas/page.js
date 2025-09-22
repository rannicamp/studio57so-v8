//app\(main)\contatos\duplicatas\page.js
"use client";

import { useState, useEffect } from 'react';
import { useLayout } from '../../../../contexts/LayoutContext';
import DuplicateContactsManager from '../../../../components/contatos/DuplicateContactsManager';
import LinkEmployeesToContacts from '../../../../components/contatos/LinkEmployeesToContacts';
import Link from 'next/link';

const TabButton = ({ label, activeTab, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-3 text-lg font-semibold border-b-4 transition-colors duration-300 
            ${activeTab === label ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
        {label}
    </button>
);


export default function FerramentasContatoPage() {
    const { setPageTitle } = useLayout();
    const [activeTab, setActiveTab] = useState('Vincular Funcionários'); // Inicia na nova aba

    useEffect(() => {
        setPageTitle('Ferramentas de Contatos e Funcionários');
    }, [setPageTitle]);
    
    return (
        <div className="space-y-6">
            <Link href="/contatos" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para a Lista de Contatos
            </Link>

            <div className="border-b border-gray-200">
                <nav className="flex space-x-4">
                    <TabButton 
                        label="Vincular Funcionários" 
                        activeTab={activeTab}
                        onClick={() => setActiveTab('Vincular Funcionários')}
                    />
                    <TabButton 
                        label="Mesclar Contatos Duplicados" 
                        activeTab={activeTab}
                        onClick={() => setActiveTab('Mesclar Contatos Duplicados')}
                    />
                </nav>
            </div>
            
            <div className="mt-6">
                {activeTab === 'Vincular Funcionários' && (
                    <LinkEmployeesToContacts />
                )}
                {activeTab === 'Mesclar Contatos Duplicados' && (
                    <DuplicateContactsManager />
                )}
            </div>
        </div>
    );
}