// app/(main)/crm/page.js
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { useEmpreendimento } from '@/contexts/EmpreendimentoContext';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faSearch, faPlus } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

import FunilKanban from '@/components/crm/FunilKanban';
import CrmNotesModal from '@/components/crm/CrmNotesModal';
import CrmDetalhesSidebar from '@/components/crm/CrmDetalhesSidebar';
import AtividadeModal from '@/components/AtividadeModal';

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) {
        return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark key={i} className="bg-yellow-200 px-0 rounded">
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};

const AddContactModal = ({ isOpen, onClose, onSearch, results, onAddContact, existingContactIds }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    const handleInputChange = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        onSearch(term);
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Adicionar Contato ao Funil</h3>
                    <button onClick={onClose}><FontAwesomeIcon icon={faTimes} /></button>
                </div>
                <div className="relative mb-4">
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Pesquisar por nome, empresa, CPF ou CNPJ..."
                        className="w-full p-2 pl-10 border rounded-md"
                        value={searchTerm}
                        onChange={handleInputChange}
                        autoFocus
                    />
                </div>
                <div className="max-h-64 overflow-y-auto">
                    {results.map(contact => {
                        const isAlreadyInFunnel = existingContactIds.includes(contact.id);
                        return (
                            <div key={contact.id} className="flex justify-between items-center p-2 border-b">
                                <span>
                                    <HighlightedText text={contact.nome || contact.razao_social} highlight={searchTerm} />
                                </span>
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
    
    const [funilId, setFunilId] = useState(null);
    const [contatosNoFunil, setContatosNoFunil] = useState([]);
    const [colunasDoFunil, setColunasDoFunil] = useState([]);
    const [loadingFunil, setLoadingFunil] = useState(true);

    const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [currentContactFunilIdForNotes, setCurrentContactFunilIdForNotes] = useState(null);
    const [currentContactIdForNotes, setCurrentContactIdForNotes] = useState(null);
    const [availableProducts, setAvailableProducts] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedContactForSidebar, setSelectedContactForSidebar] = useState(null);
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [contactForNewActivity, setContactForNewActivity] = useState(null);
    const [activityToEdit, setActivityToEdit] = useState(null);
    const [funcionarios, setFuncionarios] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

    const fetchActivityModalData = useCallback(async () => {
        const { data: funcData } = await supabase.from('funcionarios').select('id, full_name').order('full_name');
        setFuncionarios(funcData || []);
        const { data: empresasData } = await supabase.from('cadastro_empresa').select('id, razao_social').order('razao_social');
        setEmpresas(empresasData || []);
    }, [supabase]);

    useEffect(() => {
        fetchActivityModalData();
    }, [fetchActivityModalData]);
    
    const fetchAvailableProducts = useCallback(async () => {
        let query = supabase.from('produtos_empreendimento').select('id, unidade, tipo, valor_venda_calculado, empreendimento_id').eq('status', 'Disponível');
        if (selectedEmpreendimento && selectedEmpreendimento !== 'all') {
            query = query.eq('empreendimento_id', selectedEmpreendimento);
        }
        query = query.order('unidade');
        const { data, error } = await query;
        if (error) { toast.error("Não foi possível carregar a lista de produtos."); } 
        else { setAvailableProducts(data || []); }
    }, [supabase, selectedEmpreendimento]);

    useEffect(() => {
        fetchAvailableProducts();
    }, [selectedEmpreendimento, fetchAvailableProducts]);


    const fetchFunilData = useCallback(async () => {
        setLoadingFunil(true);
        try {
            const { data: funilData, error: funilError } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').single();
            if (funilError && funilError.code !== 'PGRST116') throw funilError;
            
            let currentFunilId = funilData?.id;
            if (!currentFunilId) {
                const { data: newFunil, error: createError } = await supabase.from('funis').insert({ nome: 'Funil de Vendas' }).select().single();
                if(createError) throw createError;
                currentFunilId = newFunil.id;
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
                        id, coluna_id, numero_card, produto_id, corretor_id,
                        produto:produto_id(id, unidade, tipo, valor_venda_calculado, empreendimento_id), 
                        contatos:contato_id ( *, telefones ( telefone, tipo ), emails(email, tipo)),
                        corretores:corretor_id (id, nome, razao_social)
                    `)
                    .in('coluna_id', colunaIds);
                if (contatosError) throw contatosError;

                const contatosParaEstado = (contatosNoFunilRaw || []).map(item => {
                    if (!item.contatos || !item.contatos.id) return { ...item, contatos: null };
                    return item;
                }).filter(item => item.contatos !== null);

                const contatoIds = contatosParaEstado.map(c => c.contatos.id);
                const { data: lastMessagesData } = await supabase.rpc('get_last_messages_for_contacts', { p_contact_ids: contatoIds });

                const lastMessagesMap = (lastMessagesData || []).reduce((map, msg) => {
                    map[msg.contato_id] = { content: msg.content, sent_at: msg.sent_at };
                    return map;
                }, {});

                const contatosComMensagens = contatosParaEstado.map(item => ({
                    ...item,
                    contatos: {
                        ...item.contatos,
                        last_whatsapp_message: lastMessagesMap[item.contatos.id]?.content || null,
                        last_whatsapp_message_time: lastMessagesMap[item.contatos.id]?.sent_at || null,
                    }
                }));

                setContatosNoFunil(contatosComMensagens);
            } else {
                setContatosNoFunil([]);
            }
        } catch (error) { toast.error(`Erro ao carregar dados do funil: ${error.message}`);
        } finally {
            setLoadingFunil(false);
        }
    }, [supabase]);

    useEffect(() => {
        setPageTitle("Funil de Vendas");
        fetchFunilData();
    }, [setPageTitle, fetchFunilData]);
    
    const openAddContactModal = () => { setSearchResults([]); setIsAddContactModalOpen(true); };

    const debounceTimeoutRef = useRef(null);

    const handleSearch = useCallback((term) => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        if (!term.trim() || term.length < 2) {
            setSearchResults([]);
            return;
        }

        debounceTimeoutRef.current = setTimeout(async () => {
            const { data, error } = await supabase.rpc('buscar_contatos_geral', { p_search_term: term });
            if (error) {
                toast.error("Erro ao buscar contatos.");
            }
            setSearchResults(data || []);
        }, 300);
    }, [supabase]);

    const handleAddContactToFunnel = async (contactId) => { try { const { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funilId).order('ordem').limit(1).single(); if (!primeiraColuna) throw new Error("Coluna inicial não encontrada."); const { error } = await supabase.from('contatos_no_funil').insert({ contato_id: contactId, coluna_id: primeiraColuna.id }); if (error) throw new Error(error.message); setIsAddContactModalOpen(false); toast.success('Contato adicionado ao funil!'); fetchFunilData(); } catch (error) { toast.error(`Erro: ${error.message}`); }};
    const handleAssociateProduct = async (contatoNoFunilId, produtoId) => { setContatosNoFunil(prev => prev.map(c => c.id === contatoNoFunilId ? { ...c, produto_id: produtoId, produto: availableProducts.find(p => p.id === produtoId) } : c)); const { error } = await supabase.from('contatos_no_funil').update({ produto_id: produtoId }).eq('id', contatoNoFunilId); if (error) { toast.error("Falha ao associar produto."); fetchFunilData(); } else { toast.success("Produto associado!"); }};
    
    const handleAssociateCorretor = async (contatoNoFunilId, corretorId) => {
        const { error } = await supabase
            .from('contatos_no_funil')
            .update({ corretor_id: corretorId })
            .eq('id', contatoNoFunilId);

        if (error) {
            toast.error("Falha ao associar corretor: " + error.message);
        } else {
            toast.success("Corretor associado com sucesso!");
            fetchFunilData();
        }
    };
    
    const handleStatusChange = async (contatoNoFunilId, novaColunaId) => { const novaColuna = colunasDoFunil.find(c => c.id === novaColunaId); const contatoMovido = contatosNoFunil.find(c => c.id === contatoNoFunilId); if (!novaColuna || !contatoMovido) return; if (novaColuna.nome === 'Vendido') { if (!contatoMovido.produto_id) { toast.error("Associe um produto de interesse ao card."); return; } if (!window.confirm(`Isso irá criar um novo contrato para o produto "${contatoMovido.produto.unidade}". Continuar?`)) return; setLoadingFunil(true); toast.info("Criando contrato..."); const { data: novoContrato, error: contratoError } = await supabase.from('contratos').insert({ contato_id: contatoMovido.contatos.id, produto_id: contatoMovido.produto_id, empreendimento_id: contatoMovido.produto.empreendimento_id, valor_final_venda: contatoMovido.produto.valor_venda_calculado || 0, status_contrato: 'Em assinatura' }).select('id').single(); if (contratoError) { toast.error(`Erro: ${contratoError.message}`); setLoadingFunil(false); return; } await supabase.rpc('mover_contato_e_atualizar_produto', { p_contato_no_funil_id: contatoNoFunilId, p_nova_coluna_id: novaColunaId }); toast.success("Contrato criado! Redirecionando..."); router.push(`/contratos/${novoContrato.id}`); } else { const originalContatos = [...contatosNoFunil]; setContatosNoFunil(prev => prev.map(c => c.id === contatoNoFunilId ? { ...c, coluna_id: novaColunaId } : c)); try { const payload = { contatoId: contatoNoFunilId, novaColunaId: novaColunaId }; const response = await fetch('/api/crm', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!response.ok) { const result = await response.json(); throw new Error(result.error); } toast.success('Contato movido!'); fetchFunilData(); } catch (error) { toast.error(`Erro: ${error.message}`); setContatosNoFunil(originalContatos); }}};
    const handleCreateColumn = async (columnName) => { try { const response = await fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ funilId: funilId, nomeColuna: columnName }), }); const result = await response.json(); if (!response.ok) throw new Error(result.error); toast.success('Etapa criada!'); fetchFunilData(); } catch (e) { toast.error(`Erro: ${e.message}`); }};
    const handleEditColumn = async (columnId, newName) => { try { const response = await fetch('/api/crm', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ columnId: columnId, newName: newName }), }); const result = await response.json(); if (!response.ok) throw new Error(result.error); toast.success('Etapa atualizada!'); fetchFunilData(); } catch (e) { toast.error(`Erro: ${e.message}`); }};
    const handleDeleteColumn = async (columnId) => { try { const response = await fetch(`/api/crm?columnId=${columnId}`, { method: 'DELETE' }); const result = await response.json(); if (!response.ok) throw new Error(result.error); toast.success('Etapa deletada!'); fetchFunilData(); } catch (e) { toast.error(`Erro: ${e.message}`); }};
    const handleReorderColumns = async (reorderedColumns) => { setColunasDoFunil(reorderedColumns); try { const response = await fetch('/api/crm', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reorderColumns: reorderedColumns, funilId: funilId }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); toast.success('Ordem atualizada!'); fetchFunilData(); } catch (e) { toast.error(`Erro: ${e.message}`); }};
    const handleOpenNotesModal = (funilEntryId, contatoGeneralId) => { setCurrentContactFunilIdForNotes(funilEntryId); setCurrentContactIdForNotes(contatoGeneralId); setIsNotesModalOpen(true); };
    const handleCardClick = (funilEntry) => { setSelectedContactForSidebar(funilEntry); setIsSidebarOpen(true); };
    const handleCloseSidebar = () => { setIsSidebarOpen(false); setSelectedContactForSidebar(null); };
    const handleOpenActivityModal = (contato) => { setContactForNewActivity(contato); setActivityToEdit(null); setIsActivityModalOpen(true); };
    const handleEditActivity = (activity) => { setActivityToEdit(activity); setContactForNewActivity(null); setIsActivityModalOpen(true); };
    const handleCloseActivityModal = () => { setIsActivityModalOpen(false); setContactForNewActivity(null); setActivityToEdit(null); };

    return (
        <div className="h-full flex flex-col bg-gray-100">
            <CrmDetalhesSidebar
                open={isSidebarOpen}
                onClose={handleCloseSidebar}
                funilEntry={selectedContactForSidebar}
                onAddActivity={handleOpenActivityModal}
                onEditActivity={handleEditActivity}
                onContactUpdate={() => { fetchFunilData(); }}
                refreshKey={sidebarRefreshKey}
            />
            {isActivityModalOpen && ( <AtividadeModal isOpen={isActivityModalOpen} onClose={handleCloseActivityModal} onActivityAdded={() => { toast.success(`Atividade ${activityToEdit ? 'atualizada' : 'adicionada'}!`); if (isSidebarOpen) { setSidebarRefreshKey(prev => prev + 1); } }} activityToEdit={activityToEdit} initialContatoId={contactForNewActivity?.id} funcionarios={funcionarios} allEmpresas={empresas} /> )}
            
            <div className="flex-shrink-0 bg-white shadow-sm">
                <div className="flex justify-between items-center p-4">
                    <h1 className="text-xl font-bold text-gray-800">Funil de Vendas</h1>
                    <button onClick={openAddContactModal} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2">
                        <FontAwesomeIcon icon={faPlus} /> Adicionar Contato
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-hidden">
                {loadingFunil ? (
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
                        onAssociateCorretor={handleAssociateCorretor}
                        onCardClick={handleCardClick}
                        onAddActivity={handleOpenActivityModal}
                    />
                )}
            </div>
            <AddContactModal isOpen={isAddContactModalOpen} onClose={() => setIsAddContactModalOpen(false)} onSearch={handleSearch} results={searchResults} onAddContact={handleAddContactToFunnel} existingContactIds={(contatosNoFunil || []).map(c => c.contatos?.id).filter(Boolean)} />
            <CrmNotesModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} contatoNoFunilId={currentContactFunilIdForNotes} contatoId={currentContactIdForNotes} />
        </div>
    );
}