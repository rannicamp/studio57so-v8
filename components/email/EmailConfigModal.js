'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPlug, faSignature, faRobot } from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import EmailConnectionConfig from './EmailConnectionConfig';
import EmailSignatureConfig from './EmailSignatureConfig';
import EmailRulesConfig from './EmailRulesConfig';

export default function EmailConfigModal({ isOpen, onClose, initialTab = 'connection', rulePrefill }) {
    const supabase = createClient();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState(initialTab); 

    // Atualiza a aba se o initialTab mudar quando abrir
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    const { data: existingConfig, isLoading } = useQuery({
        queryKey: ['emailConfig', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('email_configuracoes')
                .select('*')
                .eq('user_id', user.id)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return data;
        },
        enabled: isOpen && !!user,
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col h-[85vh] md:h-auto md:max-h-[90vh] animate-fade-in-up">
                
                {/* Header e Abas */}
                <div className="border-b bg-gray-50 flex flex-col">
                    <div className="px-6 py-4 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-800">Configurações de E-mail</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                            <FontAwesomeIcon icon={faTimes} className="text-lg" />
                        </button>
                    </div>
                    
                    <div className="flex px-6 gap-6 overflow-x-auto">
                        <button 
                            onClick={() => setActiveTab('connection')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'connection' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            <FontAwesomeIcon icon={faPlug} /> Conexão
                        </button>
                        <button 
                            onClick={() => setActiveTab('signature')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'signature' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            <FontAwesomeIcon icon={faSignature} /> Assinatura
                        </button>
                        <button 
                            onClick={() => setActiveTab('rules')}
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'rules' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            <FontAwesomeIcon icon={faRobot} /> Regras & Automação
                        </button>
                    </div>
                </div>

                {/* Conteúdo Dinâmico */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-grow bg-white h-[500px]">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40 text-gray-400">Carregando...</div>
                    ) : (
                        <>
                            {activeTab === 'connection' && <EmailConnectionConfig initialData={existingConfig} onClose={onClose} />}
                            {activeTab === 'signature' && <EmailSignatureConfig initialData={existingConfig} onClose={onClose} />}
                            {/* Repassa o dado inteligente para o componente de regras */}
                            {activeTab === 'rules' && <EmailRulesConfig prefillData={rulePrefill} />} 
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}