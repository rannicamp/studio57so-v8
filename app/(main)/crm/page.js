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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [targetColumnId, setTargetColumnId] = useState(null);
    const [searchResults, setSearchResults] = useState([]);

    const fetchFunilData = useCallback(async () => {
        setLoadingFunil(true);
        try {
            const { data: funilData } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').single();
            if (!funilData) throw new Error('Funil principal não encontrado.');
            setFunilId(funilData.id);

            const { data: colunasData } = await supabase.from('colunas_funil').select('*').eq('funil_id', funilData.id).order('ordem');
            setColunasDoFunil(colunasData || []);

            const { data: contatosData } = await supabase.from('contatos_no_funil').select('id, coluna_id, contatos:contato_id (*)');
            setContatosNoFunil(contatosData || []);

        } catch (error) {
            console.error('Erro ao carregar dados do funil:', error.message);
            toast.error('Erro ao carregar dados do funil.');
        } finally {
            setLoadingFunil(false);
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
        setIsModalOpen(true);
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
        const { error } = await supabase
            .from('contatos_no_funil')
            .insert({ contato_id: contactId, coluna_id: targetColumnId });

        if (error) {
            console.error("Erro ao adicionar contato:", error);
            toast.error(`Não foi possível adicionar o contato. Erro: ${error.message}`);
        } else {
            setIsModalOpen(false);
            toast.success('Contato adicionado ao funil com sucesso!');
            fetchFunilData();
        }
    };
    
    const handleStatusChange = async (contatoNoFunilId, novaColunaId) => {
        setContatosNoFunil(prev => prev.map(c => 
            c.id === contatoNoFunilId ? { ...c, coluna_id: novaColunaId } : c
        ));
        const { error } = await supabase.from('contatos_no_funil').update({ coluna_id: novaColunaId }).eq('id', contatoNoFunilId);
        if (error) {
            console.error('Erro ao mover contato:', error);
            toast.error('Erro ao mover contato.');
            fetchFunilData(); // Refetch data to revert to correct state
        } else {
            toast.success('Contato movido com sucesso!');
        }
    };

    const handleCreateColumn = async (columnName) => {
        if (!funilId) {
            toast.error("ID do Funil não encontrado. Não é possível criar a coluna.");
            return;
        }
        const maxOrder = colunasDoFunil.reduce((max, col) => Math.max(max, col.ordem || 0), 0);
        const { error } = await supabase.from('colunas_funil').insert({ nome: columnName, funil_id: funilId, ordem: maxOrder + 1 });
        if (error) {
            console.error("Erro detalhado ao criar etapa:", error);
            toast.error(`Não foi possível criar a etapa. Verifique as permissões do banco de dados.`);
        } else {
            toast.success('Etapa criada com sucesso!');
            fetchFunilData();
        }
    };

    const handleEditColumn = async (columnId, newName) => {
        try {
            const response = await fetch('/api/crm', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ columnId, newName }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao atualizar o nome da coluna.');
            }
            setColunasDoFunil(prev => prev.map(col => col.id === columnId ? { ...col, nome: newName } : col));
            toast.success('Nome da etapa atualizado com sucesso!');
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
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao deletar a coluna.');
            }
            
            setColunasDoFunil(prev => prev.filter(col => col.id !== columnId));
            setContatosNoFunil(prev => prev.filter(c => c.coluna_id !== columnId)); 
            toast.success('Etapa deletada com sucesso!');
        } catch (error) {
            console.error("Erro ao deletar etapa:", error.message);
            toast.error(`Não foi possível deletar a etapa. Erro: ${error.message}`);
        }
    };

    const handleReorderColumns = async (newOrder) => {
        // Salva o estado original das colunas para reverter em caso de erro
        const originalColunas = [...colunasDoFunil]; 
        
        // Otimista: atualiza a interface antes da resposta da API
        // Isso garante que a UI reaja instantaneamente, melhorando a experiência do usuário
        const updatedColunas = newOrder.map(reorderedCol => {
            const originalCol = originalColunas.find(col => col.id === reorderedCol.id);
            return { ...originalCol, ordem: reorderedCol.ordem };
        }).sort((a, b) => a.ordem - b.ordem); // Garante a ordenação local
        setColunasDoFunil(updatedColunas);

        try {
            const response = await fetch('/api/crm', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reorderColumns: newOrder, funilId: funilId }),
            });

            // Verifica se a resposta não foi OK (status 4xx ou 5xx)
            if (!response.ok) {
                // Tenta ler o corpo da resposta como texto primeiro
                const errorText = await response.text();
                let errorMessage = `Erro no servidor (${response.status} ${response.statusText})`;
                
                // Tenta parsear o texto como JSON para obter detalhes mais específicos
                try {
                    const parsedError = JSON.parse(errorText);
                    errorMessage = parsedError.error || errorMessage;
                } catch (parseError) {
                    // Se o texto não for JSON válido, usa o texto puro ou uma mensagem genérica
                    console.error("Erro ao tentar parsear a resposta de erro como JSON:", parseError, "Resposta original:", errorText);
                    // Não altera errorMessage, pois já tem um fallback decente
                }

                // Reverte o estado das colunas na interface, já que a operação falhou
                setColunasDoFunil(originalColunas); 
                toast.error(`Não foi possível reordenar as etapas. Detalhes: ${errorMessage}`);
                // Lança um erro para interromper a execução e ser capturado pelo catch externo
                throw new Error(`API Error: ${errorMessage}`); 
            }

            // Se a resposta foi OK, tenta parsear como JSON
            const data = await response.json();
            if (data.success) {
                toast.success('Ordem das etapas atualizada com sucesso!');
            } else {
                // Se 'success' for falso, mesmo com status OK, significa um erro lógico
                setColunasDoFunil(originalColunas); // Reverte
                toast.error(`Falha ao reordenar as etapas: ${data.message || 'Erro desconhecido.'}`);
            }

        } catch (error) {
            // Captura erros de rede ou erros lançados pelos 'throw new Error' acima
            console.error("Erro geral ao reordenar colunas:", error); 
            toast.error(`Ocorreu um erro ao reordenar as etapas: ${error.message || 'Erro desconhecido.'}`);
            setColunasDoFunil(originalColunas); // Garante a reversão em qualquer erro
        }
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
                        />
                    )
                )}
                {/* --- CÓDIGO CORRIGIDO AQUI --- */}
                {activeTab === 'whatsapp' && (
                    loadingWhatsapp ? (
                        <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                    ) : (
                        <WhatsAppChatManager contatos={contatosWhatsapp} />
                    )
                )}
            </div>

            <AddContactModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSearch={handleSearch}
                results={searchResults}
                onAddContact={handleAddContactToFunnel}
                existingContactIds={(contatosNoFunil || []).map(c => c.contatos.id)}
            />
        </div>
    );
}
