// app/(main)/crm/page.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faSearch } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

import FunilKanban from '@/components/crm/FunilKanban';
import WhatsAppChatManager from '@/components/WhatsAppChatManager';
import CrmNotesModal from '@/components/crm/CrmNotesModal'; // Importado o novo modal de notas

// --- Componente da Janela de Busca ---
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
                                <span>{contact.nome}</span>
                                <button
                                    onClick={() => onAddContact(contact.id)}
                                    className={`px-3 py-1 text-sm rounded-md ${isAlreadyInFunnel ? 'bg-gray-300' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                                    disabled={isAlreadyInFunnel}
                                >
                                    {isAlreadyInFunnel ? 'Já no Funil' : 'Adicionar'}
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
    const supabase = createClient();
    
    const [activeTab, setActiveTab] = useState('funil');
    const [funilId, setFunilId] = useState(null);

    // Estados do FUNIL
    const [contatosNoFunil, setContatosNoFunil] = useState([]);
    const [colunasDoFunil, setColunasDoFunil] = useState([]);
    const [loadingFunil, setLoadingFunil] = useState(true);

    // Estados do WHATSAPP
    const [contatosWhatsapp, setContatosWhatsapp] = useState([]);
    const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);

    // Estados para a janela de busca
    const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false); // Renomeado para clareza
    const [targetColumnId, setTargetColumnId] = useState(null);
    const [searchResults, setSearchResults] = useState([]);

    // Novos estados para o Modal de Notas
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [currentContactFunilIdForNotes, setCurrentContactFunilIdForNotes] = useState(null);
    const [currentContactIdForNotes, setCurrentContactIdForNotes] = useState(null);


    const fetchFunilData = useCallback(async () => {
        setLoadingFunil(true);
        console.log('fetchFunilData: Iniciando busca de dados do funil.');
        try {
            const { data: funilData, error: funilError } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').single();
            if (funilError && funilError.code !== 'PGRST116') {
                console.error('fetchFunilData: Erro ao buscar funil principal:', funilError);
                throw funilError;
            }
            
            let currentFunilId = funilData?.id;
            console.log('fetchFunilData: Funil principal encontrado/criado ID:', currentFunilId);

            if (!currentFunilId) {
                console.log('fetchFunilData: Funil não encontrado, criando funil padrão...');
                const response = await fetch('/api/crm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ empreendimentoId: 'default' })
                });
                const newFunnel = await response.json();
                if (!response.ok) {
                    console.error('fetchFunilData: Erro na resposta ao criar funil padrão:', newFunnel.error);
                    throw new Error(`Falha ao criar funil padrão: ${newFunnel.error || 'Erro desconhecido'}`);
                }
                currentFunilId = newFunnel.id;
                console.log('fetchFunilData: Funil padrão criado com ID:', currentFunilId);
            }
            setFunilId(currentFunilId);


            console.log('fetchFunilData: Buscando colunas do funil...');
            const { data: colunasData, error: colunasError } = await supabase
                .from('colunas_funil')
                .select('id, nome, ordem')
                .eq('funil_id', currentFunilId)
                .order('ordem', { ascending: true });

            if (colunasError) {
                console.error('fetchFunilData: Erro ao buscar colunas do funil:', colunasError);
                throw colunasError;
            }
            setColunasDoFunil(colunasData || []);
            console.log('fetchFunilData: Colunas carregadas:', colunasData);


            let contatosParaEstado = []; 
            if (colunasData && colunasData.length > 0) {
                const colunaIds = colunasData.map(col => col.id);
                console.log('fetchFunilData: Buscando contatos no funil para as colunas:', colunaIds);
                const { data: contatosNoFunilRaw, error: contatosError } = await supabase
                    .from('contatos_no_funil')
                    .select(`
                        id, 
                        coluna_id, 
                        numero_card,
                        contatos:contato_id (
                            id, 
                            nome, 
                            razao_social, 
                            created_at, 
                            telefones ( telefone, tipo ),
                            whatsapp_messages (content, sent_at, direction)
                        )
                    `)
                    .in('coluna_id', colunaIds);

                if (contatosError) {
                    console.error('fetchFunilData: Erro ao buscar contatos no funil:', contatosError);
                    throw contatosError;
                }
                console.log('fetchFunilData: Contatos brutos carregados:', contatosNoFunilRaw);

                contatosParaEstado = (contatosNoFunilRaw || []).map(item => {
                    if (!item.contatos) {
                        console.warn(`fetchFunilData: Contato ID nulo para contatos_no_funil ID: ${item.id}. Este item será filtrado.`);
                        return { ...item, contatos: null }; 
                    }

                    const contato = item.contatos;
                    let lastWhatsappMessage = null;
                    let lastWhatsappMessageTime = null;

                    if (contato.whatsapp_messages && contato.whatsapp_messages.length > 0) {
                        const sortedMessages = [...contato.whatsapp_messages].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
                        lastWhatsappMessage = sortedMessages[0]?.content; // Usar optional chaining aqui também
                        lastWhatsappMessageTime = sortedMessages[0]?.sent_at;
                        console.log(`fetchFunilData: Processando contato ${contato.id}, última mensagem:`, lastWhatsappMessage);
                    } else {
                        console.log(`fetchFunilData: Contato ${contato.id} sem mensagens WhatsApp.`);
                    }

                    return {
                        ...item,
                        contatos: {
                            ...contato,
                            last_whatsapp_message: lastWhatsappMessage,
                            last_whatsapp_message_time: lastWhatsappMessageTime,
                        }
                    };
                }).filter(item => item.contatos !== null); 
                console.log('fetchFunilData: Contatos processados para o estado:', contatosParaEstado);
            } else {
                console.log('fetchFunilData: Nenhuma coluna encontrada, contatosParaEstado permanece vazio.');
            }
            setContatosNoFunil(contatosParaEstado); 
            console.log('fetchFunilData: Estado de contatosNoFunil atualizado.');

        } catch (error) {
            console.error('fetchFunilData: Erro CATCH geral ao carregar dados do funil:', error); // Log do objeto de erro completo
            toast.error(`Erro ao carregar dados do funil. Detalhes: ${error.message || error.toString()}`);
        } finally {
            setLoadingFunil(false);
            console.log('fetchFunilData: Finalizado.');
        }
    }, [supabase]);

    const fetchWhatsappData = useCallback(async () => {
        setLoadingWhatsapp(true);
        try {
            const { data, error } = await supabase.from('contatos').select(`*, telefones (id, telefone, tipo)`);
            if (error) throw error;
            setContatosWhatsapp(data || []);
        } catch (error) {
            console.error("Erro ao buscar contatos para o WhatsApp:", error.message);
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

    const openAddContactModal = (columnId) => {
        setTargetColumnId(columnId);
        setSearchResults([]);
        setIsAddContactModalOpen(true); 
    };

    const handleSearch = async (term) => {
        if (!term.trim()) {
            setSearchResults([]);
            return;
        }
        const { data, error } = await supabase
            .from('contatos')
            .select('*')
            .or(`nome.ilike.%${term}%,cpf.ilike.%${term}%,cnpj.ilike.%${term}%`)
            .limit(10);
        
        if (error) console.error("Erro na busca:", error);
        setSearchResults(data || []);
    };

    const handleAddContactToFunnel = async (contactId) => {
        try {
            const response = await fetch('/api/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contatoIdParaFunil: contactId, funilId: funilId }),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Erro desconhecido ao adicionar contato ao funil.");
            }
            setIsAddContactModalOpen(false); 
            toast.success('Contato adicionado ao funil com sucesso!');
            fetchFunilData();
        } catch (error) {
            console.error("Erro ao adicionar contato:", error);
            toast.error(`Não foi possível adicionar o contato. Erro: ${error.message}`);
        }
    };
    
    const handleStatusChange = async (contatoNoFunilId, novaColunaId) => {
        setContatosNoFunil(prev => {
            const newState = prev.map(c => 
                c.id === contatoNoFunilId ? { ...c, coluna_id: novaColunaId } : c
            );
            return newState;
        });

        try {
            const payload = { contatoId: contatoNoFunilId, novaColunaId: novaColunaId };

            const response = await fetch('/api/crm', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Erro no servidor (${response.status} ${response.statusText})`);
            }
            toast.success('Contato movido com sucesso!');
            fetchFunilData(); 
        } catch (error) {
            console.error('Erro ao mover contato:', error);
            toast.error(`Não foi possível mover o contato. Detalhes: ${error.message}`);
            fetchFunilData(); 
        }
    };

    const handleCreateColumn = async (columnName) => {
        if (!funilId) {
            toast.error("ID do Funil não encontrado. Não é possível criar a coluna.");
            return;
        }
        try {
            const response = await fetch('/api/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ funilId: funilId, nomeColuna: columnName }),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Erro desconhecido ao criar etapa.");
            }
            toast.success('Etapa criada com sucesso!');
            fetchFunilData();
        } catch (error) {
            console.error("Erro detalhado ao criar etapa:", error);
            toast.error(`Não foi possível criar a etapa. Verifique as permissões do banco de dados. Erro: ${error.message}`);
        }
    };

    const handleEditColumn = async (columnId, newName) => {
        try {
            const response = await fetch('/api/crm', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ columnId: columnId, newName: newName }),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Erro desconhecido ao editar etapa.");
            }
            toast.success('Nome da etapa atualizado com sucesso!');
            fetchFunilData();
        } catch (error) {
            console.error("Erro ao editar etapa:", error.message);
            toast.error(`Não foi possível editar a etapa. Erro: ${error.message}`);
        }
    };

    const handleDeleteColumn = async (columnId) => {
        try {
            const response = await fetch(`/api/crm?columnId=${columnId}`, {
                method: 'DELETE',
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Erro desconhecido ao deletar etapa.");
            }
            toast.success('Etapa deletada com sucesso!');
            fetchFunilData();
        } catch (error) {
            console.error("Erro ao deletar etapa:", error.message);
            toast.error(`Não foi possível deletar a etapa. Erro: ${error.message}`);
        }
    };

    const handleReorderColumns = async (reorderedColumns) => {
        setColunasDoFunil(reorderedColumns);
    
        try {
            const payload = { reorderColumns: reorderedColumns, funilId: funilId };

            const response = await fetch('/api/crm', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
    
            const result = await response.json();
    
            if (!response.ok) {
                throw new Error(result.error || `Erro no servidor (${response.status} ${response.statusText})`);
            }
            toast.success('Ordem das colunas atualizada com sucesso!');
            fetchFunilData();
        } catch (error) {
            console.error('Erro ao reordenar colunas:', error);
            toast.error(`Não foi possível reordenar as colunas. Detalhes: ${error.message}`);
            fetchFunilData();
        }
    };

    // Nova função para abrir o modal de notas
    const handleOpenNotesModal = (funilEntryId, contatoGeneralId) => {
        setCurrentContactFunilIdForNotes(funilEntryId);
        setCurrentContactIdForNotes(contatoGeneralId);
        setIsNotesModalOpen(true);
    };

    const tabStyle = "px-6 py-2 font-semibold rounded-t-lg transition-colors duration-200 focus:outline-none";
    const activeTabStyle = "bg-white text-blue-600 shadow-sm";
    const inactiveTabStyle = "bg-gray-200 text-gray-600 hover:bg-gray-300";
    
    return (
        <div className="h-full flex flex-col">
            <div className="flex border-b border-gray-200 bg-gray-100 px-4">
                <button onClick={() => setActiveTab('funil')} className={`${tabStyle} ${activeTab === 'funil' ? activeTabStyle : inactiveTabStyle}`}>Funil de Vendas</button>
                <button onClick={() => setActiveTab('whatsapp')} className={`${tabStyle} ${activeTab === 'whatsapp' ? activeTabStyle : inactiveTabStyle}`}>WhatsApp</button>
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
                            onOpenNotesModal={handleOpenNotesModal} // Passando a nova função
                        />
                    )
                )}
                {activeTab === 'whatsapp' && (
                    loadingWhatsapp ? (
                        <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                    ) : (
                        <WhatsAppChatManager contatos={contatosWhatsapp} />
                    )
                )}
            </div>

            <AddContactModal
                isOpen={isAddContactModalOpen} // Usando o novo estado
                onClose={() => setIsAddContactModalOpen(false)} // Usando o novo estado
                onSearch={handleSearch}
                results={searchResults}
                onAddContact={handleAddContactToFunnel}
                existingContactIds={(contatosNoFunil || []).map(c => c.contatos?.id).filter(Boolean)}
            />

            {/* Novo Modal de Notas */}
            <CrmNotesModal
                isOpen={isNotesModalOpen}
                onClose={() => setIsNotesModalOpen(false)}
                contatoNoFunilId={currentContactFunilIdForNotes}
                contatoId={currentContactIdForNotes}
            />
        </div>
    );
}
