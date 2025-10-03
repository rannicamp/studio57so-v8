"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { toast } from 'sonner';
import WhatsAppChatManager from '@/components/whatsapp/WhatsAppChatManager';

// Lógica de busca de dados, agora otimizada.
const fetchWhatsappContacts = async (supabase) => {
    const { data, error } = await supabase.rpc('get_contacts_with_details');
    if (error) {
        console.error("Erro ao buscar contatos via RPC:", error);
        throw new Error(`Falha ao buscar contatos: ${error.message}`);
    }
    return data;
};

export default function CaixaDeEntradaPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();
    const queryClient = useQueryClient();
    
    // Estado para controlar o contato aberto em TODAS as views
    const [currentlyOpenContact, setCurrentlyOpenContact] = useState(null);
    const notificationSoundRef = useRef(null);
    
    // Controle para a notificação de atualização
    const isFetchingRef = useRef(false);
    const initialLoadComplete = useRef(false);

    const { data: contatosWhatsapp = [], isLoading: loadingWhatsapp, isFetching, isSuccess, isError } = useQuery({
        queryKey: ['whatsappContacts'],
        queryFn: () => fetchWhatsappContacts(supabase),
        staleTime: 1000 * 60 * 1, // Cache de 1 minuto
        refetchOnWindowFocus: true, // Atualiza ao focar na janela
    });

    // Efeito para a notificação de "Página atualizada!"
    useEffect(() => {
        if (initialLoadComplete.current && !isFetching && isSuccess) {
            toast.success('Página atualizada!');
        }
        if (isSuccess || isError) {
            initialLoadComplete.current = true;
        }
        isFetchingRef.current = isFetching;
    }, [isFetching, isSuccess, isError]);

    useEffect(() => {
        setPageTitle("Caixa de Entrada");
    }, [setPageTitle]);
    
    // Listener de tempo real para novas mensagens
    useEffect(() => {
        const channel = supabase.channel('whatsapp_messages_global_listener')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
                (payload) => {
                    queryClient.invalidateQueries({ queryKey: ['whatsappContacts'] });
                    
                    const newMessage = payload.new;
                    // Toca o som apenas se a mensagem for de entrada e não for do contato já aberto
                    if (newMessage.direction === 'inbound' && newMessage.contato_id !== currentlyOpenContact?.id) {
                        notificationSoundRef.current?.play().catch(e => console.error("Erro ao tocar som:", e));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, queryClient, currentlyOpenContact]);

    const handleSelectContact = (contact) => {
        setCurrentlyOpenContact(contact);
    };
    
    const handleBackToList = () => {
        setCurrentlyOpenContact(null);
    };

    // Estilos para as abas
    const tabStyle = "px-6 py-3 text-sm font-semibold transition-colors duration-200 focus:outline-none flex items-center gap-2";
    const activeTabStyle = "text-blue-600 border-b-2 border-blue-500";
    
    return (
        <div className="h-full flex flex-col bg-gray-100">
            <audio ref={notificationSoundRef} src="/sounds/notification.mp3" preload="auto" />
            
            <div className="flex-shrink-0 bg-white shadow-sm">
                <div className="px-4 pt-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {/* Botão de voltar para a lista (só aparece no mobile) */}
                        {currentlyOpenContact && (
                            <button onClick={handleBackToList} className="md:hidden p-2 text-gray-600 hover:text-gray-800">
                                <FontAwesomeIcon icon={faArrowLeft} />
                            </button>
                        )}
                        <h1 className="text-xl font-bold text-gray-800">Canais de Atendimento</h1>
                    </div>
                </div>
                <div className="px-4">
                    <div className="flex border-b">
                        <div className={`${tabStyle} ${activeTabStyle}`}>
                            <FontAwesomeIcon icon={faWhatsapp} className="text-xl" />
                            <span>WhatsApp</span>
                            {/* Indicador de mensagens não lidas */}
                            {contatosWhatsapp.some(c => c.unread_count > 0) && (
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse ml-1"></span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-hidden">
                {loadingWhatsapp ? (
                    <div className="flex justify-center items-center h-full">
                        <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
                    </div>
                ) : (
                    <WhatsAppChatManager 
                        contatos={contatosWhatsapp}
                        selectedContact={currentlyOpenContact}
                        onSelectContact={handleSelectContact}
                        onBackToList={handleBackToList} // Passa a função para o componente filho
                    />
                )}
            </div>
        </div>
    );
}