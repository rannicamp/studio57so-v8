"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { useEmpreendimento } from '@/contexts/EmpreendimentoContext';
import { useRouter } from 'next/navigation'; // Adicionado para o redirecionamento
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faSearch, faBell, faPlus } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

import FunilKanban from '@/components/crm/FunilKanban';
import WhatsAppChatManager from '@/components/WhatsAppChatManager';
import CrmNotesModal from '@/components/crm/CrmNotesModal';

// --- Componente da Janela de Busca (sem alterações) ---
const AddContactModal = ({ isOpen, onClose, onSearch, results, onAddContact, existingContactIds }) => {
    const [searchTerm, setSearchTerm] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Adicionar Contato ao Funil</h3>
                    <button onClick={onClose}><FontAwesomeIcon icon={faTimes} /></button>
                </div>
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        placeholder="Pesquisar por nome, CPF ou CNPJ..."
                        className="flex-grow p-2 border rounded-md"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button onClick={() => onSearch(searchTerm)} className="px-4 py-2 bg-blue-600 text-white rounded-md">
                        <FontAwesomeIcon icon={faSearch} />
                    </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                    {results.map(contact => {
                        const isAlreadyInFunnel = existingContactIds.includes(contact.id);
                        return (
                            <div key={contact.id} className="flex justify-between items-center p-2 border-b">
                                <span>{contact.nome || contact.razao_social}</span>
                                <button
                                    onClick={() => onAddContact(contact.id)}
                                    className={`px-3 py-1 text-sm rounded-md ${isAlreadyInFunnel ? 'bg-gray-300' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                                    disabled={isAlreadyInFunnel}
                                >
                                    {isAlreadyInFunnel ? 'Já no Funil' : <><FontAwesomeIcon icon={faPlus} className="mr-1" /> Adicionar</>}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};


export default function CrmPage() {
    const { setPageTitle } = useLayout();
    const { selectedEmpreendimento } = useEmpreendimento();
    const supabase = createClient();
    const router = useRouter();
    
    const [activeTab, setActiveTab] = useState('funil');
    const [funilId, setFunilId] = useState(null);

    const [contatosNoFunil, setContatosNoFunil] = useState([]);
    const [colunasDoFunil, setColunasDoFunil] = useState([]);
    const [loadingFunil, setLoadingFunil] = useState(true);

    const [contatosWhatsapp, setContatosWhatsapp] = useState([]);
    const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
    const [currentlyOpenContactId, setCurrentlyOpenContactId] = useState(null);
    const notificationSoundRef = useRef(null);

    const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [currentContactFunilIdForNotes, setCurrentContactFunilIdForNotes] = useState(null);
    const [currentContactIdForNotes, setCurrentContactIdForNotes] = useState(null);

    const [availableProducts, setAvailableProducts] = useState([]);
    
    const fetchAvailableProducts = useCallback(async () => {
        let query = supabase
            .from('produtos_empreendimento')
            // --- CORREÇÃO APLICADA AQUI ---
            // O campo 'valor_venda_calculado' foi adicionado à consulta.
            .select('id, unidade, tipo, valor_venda_calculado, empreendimento_id')
            // --- FIM DA CORREÇÃO ---
            .eq('status', 'Disponível');
            
        if (selectedEmpreendimento && selectedEmpreendimento !== 'all') {
            query = query.eq('empreendimento_id', selectedEmpreendimento);
        }
        
        query = query.order('unidade');
            
        const { data, error } = await query;
            
        if (error) {
            console.error("Erro ao buscar produtos disponíveis:", error);
            toast.error("Não foi possível carregar a lista de produtos.");
        } else {
            setAvailableProducts(data || []);
        }
    }, [supabase, selectedEmpreendimento]);

    useEffect(() => {
        if (activeTab === 'funil') {
            fetchAvailableProducts();
        }
    }, [selectedEmpreendimento, activeTab, fetchAvailableProducts]);


    const fetchFunilData = useCallback(async () => {
        setLoadingFunil(true);
        try {
            const { data: funilData, error: funilError } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').single();
            if (funilError && funilError.code !== 'PGRST116') throw funilError;
            
            let currentFunilId = funilData?.id;
            if (!currentFunilId) {
                const response = await fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empreendimentoId: 'default' }) });
                const newFunnel = await response.json();
                if (!response.ok) throw new Error(`Falha ao criar funil padrão: ${newFunnel.error || 'Erro desconhecido'}`);
                currentFunilId = newFunnel.id;
            }
            setFunilId(currentFunilId);

            const { data: colunasData, error: colunasError } = await supabase.from('colunas_funil').select('id, nome, ordem').eq('funil_id', currentFunilId).order('ordem', { ascending: true });
            if (colunasError) throw colunasError;
            setColunasDoFunil(colunasData || []);

            if (colunasData && colunasData.length > 0) {
                const colunaIds = colunasData.map(col => col.id);
                
                const { data: contatosNoFunilRaw, error: contatosError } = await supabase
                    .from('contatos_no_funil')
                    .select(`
                        id, coluna_id, numero_card, produto_id, 
                        produto:produto_id(id, unidade, tipo, valor_venda_calculado, empreendimento_id),
                        contatos:contato_id (id, nome, razao_social, created_at, origem, telefones ( telefone, tipo ), whatsapp_messages (content, sent_at, direction))
                    `)
                    .in('coluna_id', colunaIds);

                if (contatosError) throw contatosError;

                const contatosParaEstado = (contatosNoFunilRaw || []).map(item => {
                    if (!item.contatos || !item.contatos.id) return { ...item, contatos: null };
                    const contato = item.contatos;
                    let lastWhatsappMessage = null;
                    let lastWhatsappMessageTime = null;
                    if (contato.whatsapp_messages && contato.whatsapp_messages.length > 0) {
                        const sortedMessages = [...contato.whatsapp_messages].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
                        lastWhatsappMessage = sortedMessages[0]?.content;
                        lastWhatsappMessageTime = sortedMessages[0]?.sent_at;
                    }
                    return { ...item, contatos: { ...contato, last_whatsapp_message: lastWhatsappMessage, last_whatsapp_message_time: lastWhatsappMessageTime } };
                }).filter(item => item.contatos !== null);
                setContatosNoFunil(contatosParaEstado);
            } else {
                setContatosNoFunil([]);
            }
        } catch (error) {
            console.error('Erro ao carregar dados do funil:', error);
            toast.error(`Erro ao carregar dados do funil. Detalhes: ${error.message || error.toString()}`);
        } finally {
            setLoadingFunil(false);
        }
    }, [supabase]);

    const fetchWhatsappData = useCallback(async () => {
        setLoadingWhatsapp(true);
        try {
            const { data: contactsData, error: contactsError } = await supabase
                .from('contatos')
                .select(`*, telefones (id, telefone, tipo), is_awaiting_name_response`);
            if (contactsError) throw contactsError;
            
            const { data: unreadData, error: unreadError } = await supabase
                .from('whatsapp_messages')
                .select('contato_id')
                .eq('is_read', false)
                .eq('direction', 'inbound');
            if (unreadError) throw unreadError;

            const unreadCounts = unreadData.reduce((acc, msg) => {
                acc[msg.contato_id] = (acc[msg.contato_id] || 0) + 1;
                return acc;
            }, {});

            const { data: lastMessagesData, error: lastMessagesError } = await supabase.rpc('get_last_messages_for_contacts');
            if (lastMessagesError) throw lastMessagesError;

            const lastMessagesMap = lastMessagesData.reduce((map, msg) => {
                map[msg.contato_id] = { content: msg.content, sent_at: msg.sent_at };
                return map;
            }, {});

            const contatosComDados = contactsData.map(contact => {
                const lastMessage = lastMessagesMap[contact.id];
                return {
                    ...contact,
                    unread_count: unreadCounts[contact.id] || 0,
                    last_whatsapp_message: lastMessage?.content || null,
                    last_whatsapp_message_time: lastMessage?.sent_at || null,
                };
            });

            const sortedContatos = contatosComDados.sort((a, b) => {
                const dateA = a.last_whatsapp_message_time ? new Date(a.last_whatsapp_message_time).getTime() : 0;
                const dateB = b.last_whatsapp_message_time ? new Date(b.last_whatsapp_message_time).getTime() : 0;
                if (dateA && dateB) return dateB - dateA;
                if (dateA) return -1;
                if (dateB) return 1;
                const nameA = a.nome || a.razao_social || '';
                const nameB = b.nome || b.razao_social || '';
                return nameA.localeCompare(nameB);
            });
            
            setContatosWhatsapp(sortedContatos);

        } catch (error) {
            console.error("Erro ao buscar dados do WhatsApp:", error.message);
            toast.error('Erro ao carregar contatos do WhatsApp.');
        } finally {
            setLoadingWhatsapp(false);
        }
    }, [supabase]);

    useEffect(() => {
        setPageTitle("CRM");
        fetchFunilData();
        fetchWhatsappData();
    }, [setPageTitle, fetchFunilData, fetchWhatsappData]);
    
    useEffect(() => {
        const channel = supabase.channel('whatsapp_messages_global_listener')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'whatsapp_messages',
                    filter: 'direction=eq.inbound'
                },
                (payload) => {
                    const newMessage = payload.new;
                    const contactId = newMessage.contato_id;

                    if (contactId === currentlyOpenContactId) {
                        return;
                    }

                    notificationSoundRef.current?.play().catch(e => console.error("Erro ao tocar som:", e));
                    
                    setContatosWhatsapp(prevContatos => {
                        let contactExists = false;
                        const updatedContatos = prevContatos.map(c => {
                            if (c.id === contactId) {
                                contactExists = true;
                                return {
                                    ...c,
                                    unread_count: (c.unread_count || 0) + 1,
                                    last_whatsapp_message: newMessage.content,
                                    last_whatsapp_message_time: newMessage.sent_at,
                                };
                            }
                            return c;
                        });
                        
                        if (!contactExists) {
                           fetchWhatsappData();
                        }

                        return updatedContatos.sort((a, b) => {
                            const dateA = a.last_whatsapp_message_time ? new Date(a.last_whatsapp_message_time).getTime() : 0;
                            const dateB = b.last_whatsapp_message_time ? new Date(b.last_whatsapp_message_time).getTime() : 0;
                            return dateB - dateA;
                        });
                    });

                    const contact = contatosWhatsapp.find(c => c.id === contactId);
                    const contactName = contact?.nome || contact?.razao_social || `Contato ${contactId}`;
                    
                    toast.info(
                        <div className="flex items-center gap-3">
                            <FontAwesomeIcon icon={faBell} className="text-blue-500" />
                            <div>
                                <p className="font-bold">Nova mensagem de {contactName}</p>
                                <p className="text-sm text-gray-600 truncate">{newMessage.content}</p>
                            </div>
                        </div>
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, contatosWhatsapp, currentlyOpenContactId, fetchWhatsappData]);


    const handleMarkAsRead = useCallback(async (contactId) => {
        setCurrentlyOpenContactId(contactId);

        setContatosWhatsapp(prev =>
            prev.map(c => c.id === contactId ? { ...c, unread_count: 0 } : c)
        );

        const { error } = await supabase
            .from('whatsapp_messages')
            .update({ is_read: true })
            .eq('contato_id', contactId)
            .eq('is_read', false);

        if (error) {
            console.error("Erro ao marcar mensagens como lidas:", error);
            toast.error("Não foi possível marcar as mensagens como lidas.");
            fetchWhatsappData();
        }
    }, [supabase, fetchWhatsappData]);
    

    const openAddContactModal = () => {
        setSearchResults([]);
        setIsAddContactModalOpen(true); 
    };

    const handleSearch = async (term) => {
        if (!term.trim()) {
            setSearchResults([]);
            return;
        }
        const { data, error } = await supabase.from('contatos').select('*').or(`nome.ilike.%${term}%,cpf.ilike.%${term}%,cnpj.ilike.%${term}%`).limit(10);
        if (error) console.error("Erro na busca:", error);
        setSearchResults(data || []);
    };

    const handleAddContactToFunnel = async (contactId) => {
        try {
            const response = await fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contatoIdParaFunil: contactId, funilId: funilId }), });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Erro desconhecido ao adicionar contato ao funil.");
            setIsAddContactModalOpen(false); 
            toast.success('Contato adicionado ao funil com sucesso!');
            fetchFunilData();
        } catch (error) {
            console.error("Erro ao adicionar contato:", error);
            toast.error(`Não foi possível adicionar o contato. Erro: ${error.message}`);
        }
    };
    
    const handleAssociateProduct = async (contatoNoFunilId, produtoId) => {
        setContatosNoFunil(prev =>
            prev.map(c =>
                c.id === contatoNoFunilId ? { ...c, produto_id: produtoId, produto: availableProducts.find(p => p.id === produtoId) } : c
            )
        );

        const { error } = await supabase
            .from('contatos_no_funil')
            .update({ produto_id: produtoId })
            .eq('id', contatoNoFunilId);

        if (error) {
            toast.error("Falha ao associar produto. Revertendo...");
            console.error(error);
            fetchFunilData();
        } else {
            toast.success("Produto associado com sucesso!");
        }
    };

    const handleStatusChange = async (contatoNoFunilId, novaColunaId) => {
        const novaColuna = colunasDoFunil.find(c => c.id === novaColunaId);
        const contatoMovido = contatosNoFunil.find(c => c.id === contatoNoFunilId);

        if (!novaColuna || !contatoMovido) return;

        // SE A COLUNA DE DESTINO FOR "Vendido"
        if (novaColuna.nome === 'Vendido') {
            if (!contatoMovido.produto_id) {
                toast.error("Para mover para 'Vendido', primeiro associe um produto de interesse ao card.");
                return;
            }
            if (!window.confirm(`Você está movendo o contato para "Vendido". Isso irá criar um novo contrato para o produto "${contatoMovido.produto.unidade}". Deseja continuar?`)) {
                return;
            }

            setLoadingFunil(true);
            toast.info("Criando contrato...");

            const { data: novoContrato, error: contratoError } = await supabase
                .from('contratos')
                .insert({
                    contato_id: contatoMovido.contatos.id,
                    produto_id: contatoMovido.produto_id,
                    empreendimento_id: contatoMovido.produto.empreendimento_id,
                    valor_final_venda: contatoMovido.produto.valor_venda_calculado || 0,
                    status_contrato: 'Em assinatura'
                })
                .select('id')
                .single();

            if (contratoError) {
                toast.error(`Erro ao criar o contrato: ${contratoError.message}`);
                setLoadingFunil(false);
                return;
            }

            await supabase.rpc('mover_contato_e_atualizar_produto', {
                p_contato_no_funil_id: contatoNoFunilId,
                p_nova_coluna_id: novaColunaId
            });

            toast.success("Contrato criado com sucesso! Redirecionando...");
            router.push(`/contratos/${novoContrato.id}`);

        } else {
            // LÓGICA ANTIGA PARA MOVER PARA QUALQUER OUTRA COLUNA
            const originalContatos = [...contatosNoFunil];
            setContatosNoFunil(prev => prev.map(c => c.id === contatoNoFunilId ? { ...c, coluna_id: novaColunaId } : c));
            try {
                const payload = { contatoId: contatoNoFunilId, novaColunaId: novaColunaId };
                const response = await fetch('/api/crm', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) { const result = await response.json(); throw new Error(result.error); }
                toast.success('Contato movido com sucesso!');
                fetchFunilData();
            } catch (error) {
                toast.error(`Não foi possível mover o contato: ${error.message}`);
                setContatosNoFunil(originalContatos);
            }
        }
    };
    
    // Demais funções (sem alterações)
    const handleCreateColumn = async (columnName) => { try { const response = await fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ funilId: funilId, nomeColuna: columnName }), }); const result = await response.json(); if (!response.ok) throw new Error(result.error); toast.success('Etapa criada!'); fetchFunilData(); } catch (e) { toast.error(`Erro: ${e.message}`); }};
    const handleEditColumn = async (columnId, newName) => { try { const response = await fetch('/api/crm', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ columnId: columnId, newName: newName }), }); const result = await response.json(); if (!response.ok) throw new Error(result.error); toast.success('Etapa atualizada!'); fetchFunilData(); } catch (e) { toast.error(`Erro: ${e.message}`); }};
    const handleDeleteColumn = async (columnId) => { try { const response = await fetch(`/api/crm?columnId=${columnId}`, { method: 'DELETE' }); const result = await response.json(); if (!response.ok) throw new Error(result.error); toast.success('Etapa deletada!'); fetchFunilData(); } catch (e) { toast.error(`Erro: ${e.message}`); }};
    const handleReorderColumns = async (reorderedColumns) => { setColunasDoFunil(reorderedColumns); try { const response = await fetch('/api/crm', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reorderColumns: reorderedColumns, funilId: funilId }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); toast.success('Ordem atualizada!'); fetchFunilData(); } catch (e) { toast.error(`Erro: ${e.message}`); fetchFunilData(); }};
    const handleOpenNotesModal = (funilEntryId, contatoGeneralId) => { setCurrentContactFunilIdForNotes(funilEntryId); setCurrentContactIdForNotes(contatoGeneralId); setIsNotesModalOpen(true); };

    const tabStyle = "px-6 py-2 font-semibold rounded-t-lg transition-colors duration-200 focus:outline-none";
    const activeTabStyle = "bg-white text-blue-600 shadow-sm";
    const inactiveTabStyle = "bg-gray-200 text-gray-600 hover:bg-gray-300";
    
    return (
        <div className="h-full flex flex-col">
            <audio ref={notificationSoundRef} src="/sounds/notification.mp3" preload="auto" />
            <div className="flex border-b border-gray-200 bg-gray-100 px-4">
                <button onClick={() => setActiveTab('funil')} className={`${tabStyle} ${activeTab === 'funil' ? activeTabStyle : inactiveTabStyle}`}>Funil de Vendas</button>
                <button onClick={() => setActiveTab('whatsapp')} className={`${tabStyle} ${activeTab === 'whatsapp' ? activeTabStyle : inactiveTabStyle}`}>
                    <div className="flex items-center gap-2">
                        <span>WhatsApp</span>
                        {contatosWhatsapp.some(c => c.unread_count > 0) && (<span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>)}
                    </div>
                </button>
            </div>
            <div className="flex-grow overflow-y-auto">
                {activeTab === 'funil' && (
                    loadingFunil ? (
                        <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                    ) : (
                        <FunilKanban
                            contatos={contatosNoFunil}
                            statusColumns={colunasDoFunil}
                            onStatusChange={handleStatusChange}
                            onCreateColumn={handleCreateColumn}
                            onAddContact={openAddContactModal}
                            onEditColumn={handleEditColumn}
                            onDeleteColumn={handleDeleteColumn}
                            onReorderColumns={handleReorderColumns}
                            onOpenNotesModal={handleOpenNotesModal}
                            availableProducts={availableProducts}
                            onAssociateProduct={handleAssociateProduct}
                        />
                    )
                )}
                {activeTab === 'whatsapp' && (
                    loadingWhatsapp ? (
                        <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                    ) : (
                        <WhatsAppChatManager 
                            contatos={contatosWhatsapp} 
                            onMarkAsRead={handleMarkAsRead}
                            onNewMessageSent={fetchWhatsappData}
                            onContactSelected={(contactId) => setCurrentlyOpenContactId(contactId)}
                        />
                    )
                )}
            </div>
            <AddContactModal
                isOpen={isAddContactModalOpen}
                onClose={() => setIsAddContactModalOpen(false)}
                onSearch={handleSearch}
                results={searchResults}
                onAddContact={handleAddContactToFunnel}
                existingContactIds={(contatosNoFunil || []).map(c => c.contatos?.id).filter(Boolean)}
            />
            <CrmNotesModal
                isOpen={isNotesModalOpen}
                onClose={() => setIsNotesModalOpen(false)}
                contatoNoFunilId={currentContactFunilIdForNotes}
                contatoId={currentContactIdForNotes}
            />
        </div>
    );
}