// app/(main)/crm/page.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { useEmpreendimento } from '@/contexts/EmpreendimentoContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faSearch, faPlus, faUsers, faHandshake, faPercent, faSackDollar, faCalendarDay } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

import FunilKanban from '@/components/crm/FunilKanban';
import CrmNotesModal from '@/components/crm/CrmNotesModal';
import CrmDetalhesSidebar from '@/components/crm/CrmDetalhesSidebar';
import AtividadeModal from '@/components/AtividadeModal';
import KpiCard from '@/components/KpiCard';

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return ( <span> {parts.map((part, i) => regex.test(part) ? (<mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark>) : (<span key={i}>{part}</span>) )} </span> );
};

const AddContactModal = ({ isOpen, onClose, onSearch, results, onAddContact, existingContactIds }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const handleInputChange = (e) => { const term = e.target.value; setSearchTerm(term); onSearch(term); };
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
                    <input type="text" placeholder="Pesquisar por nome, empresa, CPF ou CNPJ..." className="w-full p-2 pl-10 border rounded-md" value={searchTerm} onChange={handleInputChange} autoFocus />
                </div>
                <div className="max-h-64 overflow-y-auto">
                    {results.map(contact => {
                        const isAlreadyInFunnel = existingContactIds.includes(contact.id);
                        return (
                            <div key={contact.id} className="flex justify-between items-center p-2 border-b">
                                <span><HighlightedText text={contact.nome || contact.razao_social} highlight={searchTerm} /></span>
                                <button onClick={() => onAddContact(contact.id)} className={`px-3 py-1 text-sm rounded-md ${isAlreadyInFunnel ? 'bg-gray-300' : 'bg-green-500 hover:bg-green-600 text-white'}`} disabled={isAlreadyInFunnel}>
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

const fetchFunilData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { funilId: null, colunasDoFunil: [], contatosNoFunil: [] };

    const { data: funilData, error: funilError } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').eq('organizacao_id', organizacaoId).single();
    if (funilError && funilError.code !== 'PGRST116') throw funilError;
    let funilId = funilData?.id;
    
    if (!funilId) {
        const { data: newFunil, error: createError } = await supabase.from('funis').insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId }).select().single();
        if (createError) throw createError;
        funilId = newFunil.id;
    }

    const { data: colunasDoFunil, error: colunasError } = await supabase.from('colunas_funil').select('id, nome, ordem').eq('funil_id', funilId).eq('organizacao_id', organizacaoId).order('ordem', { ascending: true });
    if (colunasError) throw colunasError;

    if (!colunasDoFunil || colunasDoFunil.length === 0) {
        return { funilId, colunasDoFunil: [], contatosNoFunil: [] };
    }

    const colunaIds = colunasDoFunil.map(col => col.id);
    
    // =================================================================================
    // O PORQUÊ DA MUDANÇA (AGORA VAI!):
    // Esta é a consulta corrigida! Adicionamos a busca encadeada para pegar
    // os nomes do anúncio e da campanha.
    // 1. Em `contatos`, pedimos `meta_ads:meta_ad_id(...)` para buscar na tabela `meta_ads`.
    // 2. Dentro de `meta_ads`, pegamos o `name` (nome do anúncio).
    // 3. E também pedimos `meta_campaigns:campaign_id(...)` para buscar na tabela `meta_campaigns`.
    // 4. Dentro de `meta_campaigns`, finalmente pegamos o `name` (nome da campanha).
    // =================================================================================
    const { data: contatosNoFunilRaw, error: contatosError } = await supabase
        .from('contatos_no_funil')
        .select(`
            id, 
            coluna_id, 
            numero_card, 
            corretor_id, 
            created_at, 
            contatos:contato_id ( 
                *, 
                telefones ( telefone, tipo ), 
                emails(email, tipo),
                meta_ads:meta_ad_id (
                    name,
                    meta_campaigns:campaign_id (
                        name
                    )
                )
            ), 
            corretores:corretor_id (id, nome, razao_social), 
            produtos_interesse:contatos_no_funil_produtos (id, produto:produtos_empreendimento (id, unidade, tipo, valor_venda_calculado, empreendimento_id))
        `)
        .in('coluna_id', colunaIds)
        .eq('organizacao_id', organizacaoId);

    if (contatosError) throw contatosError;

    const contatosParaEstado = (contatosNoFunilRaw || []).filter(item => item.contatos?.id);
    const contatoIds = contatosParaEstado.map(c => c.contatos.id);

    const { data: lastMessagesData } = await supabase.rpc('get_last_messages_for_contacts', { p_contact_ids: contatoIds, p_organizacao_id: organizacaoId });

    const lastMessagesMap = (lastMessagesData || []).reduce((map, msg) => { map[msg.contato_id] = { content: msg.content, sent_at: msg.sent_at }; return map; }, {});
    const contatosComMensagens = contatosParaEstado.map(item => ({ ...item, last_whatsapp_message_time: lastMessagesMap[item.contatos.id]?.sent_at || null, contatos: { ...item.contatos, last_whatsapp_message: lastMessagesMap[item.contatos.id]?.content || null, last_whatsapp_message_time: lastMessagesMap[item.contatos.id]?.sent_at || null, } }));
    
    return { funilId, colunasDoFunil, contatosNoFunil: contatosComMensagens };
};


const fetchAvailableProducts = async (supabase, empreendimentoId, organizacaoId) => {
    if (!organizacaoId) return [];
    let query = supabase.from('produtos_empreendimento').select('id, unidade, tipo, valor_venda_calculado, empreendimento_id').eq('status', 'Disponível').eq('organizacao_id', organizacaoId);
    if (empreendimentoId && empreendimentoId !== 'all') { query = query.eq('empreendimento_id', empreendimentoId); }
    const { data, error } = await query.order('unidade');
    if (error) throw new Error("Não foi possível carregar os produtos.");
    return data || [];
};

const fetchActivityModalData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { funcionarios: [], empresas: [] };
    const { data: funcionarios, error: funcError } = await supabase.from('funcionarios').select('id, full_name').eq('organizacao_id', organizacaoId).order('full_name');
    if (funcError) throw new Error("Falha ao buscar funcionários.");
    const { data: empresas, error: empError } = await supabase.from('cadastro_empresa').select('id, razao_social').eq('organizacao_id', organizacaoId).order('razao_social');
    if (empError) throw new Error("Falha ao buscar empresas.");
    return { funcionarios, empresas };
};

export default function CrmPage() {
    const { setPageTitle } = useLayout();
    const { user, userData } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const { selectedEmpreendimento } = useEmpreendimento();
    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [sorting, setSorting] = useState({});
    const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [currentContactFunilIdForNotes, setCurrentContactFunilIdForNotes] = useState(null);
    const [currentContactIdForNotes, setCurrentContactIdForNotes] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedContactForSidebar, setSelectedContactForSidebar] = useState(null);
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [contactForNewActivity, setContactForNewActivity] = useState(null);
    const [activityToEdit, setActivityToEdit] = useState(null);
    const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
    
    useEffect(() => { setPageTitle("CRM - Funil de Vendas"); }, [setPageTitle]);

    const { data: funilData, isLoading: loadingFunil, error: funilError } = useQuery({ queryKey: ['funilData', organizacaoId], queryFn: () => fetchFunilData(supabase, organizacaoId), enabled: !!organizacaoId });
    const { funilId, colunasDoFunil = [], contatosNoFunil = [] } = funilData || {};

    const { data: availableProducts = [] } = useQuery({ queryKey: ['availableProducts', selectedEmpreendimento, organizacaoId], queryFn: () => fetchAvailableProducts(supabase, selectedEmpreendimento, organizacaoId), enabled: !!organizacaoId });
    const { data: activityData } = useQuery({ queryKey: ['activityModalData', organizacaoId], queryFn: () => fetchActivityModalData(supabase, organizacaoId), enabled: !!organizacaoId });
    const { funcionarios = [], empresas = [] } = activityData || {};
    if (funilError) { toast.error(`Erro ao carregar dados do funil: ${funilError.message}`); }

    const kpiData = useMemo(() => {
        if (!colunasDoFunil || contatosNoFunil.length === 0) return { totalLeads: 0, vendidos: 0, taxaConversao: 0, valorEmNegociacao: 0, ultimoLead: 'N/A' };
        const colunaVendido = colunasDoFunil.find(c => c.nome.toLowerCase() === 'vendido');
        const ordemVendido = colunaVendido ? colunaVendido.ordem : -1;
        const totalLeads = contatosNoFunil.length;
        const vendidos = contatosNoFunil.filter(c => c.coluna_id === colunaVendido?.id).length;
        const taxaConversao = totalLeads > 0 ? (vendidos / totalLeads) * 100 : 0;
        const valorEmNegociacao = contatosNoFunil.filter(contato => { const colunaDoContato = colunasDoFunil.find(c => c.id === contato.coluna_id); return colunaDoContato && colunaVendido && colunaDoContato.ordem < ordemVendido; }).reduce((acc, contato) => { const valorProdutos = (contato.produtos_interesse || []).reduce((sum, item) => sum + (item.produto?.valor_venda_calculado || 0), 0); return acc + valorProdutos; }, 0);
        const ultimoLeadDate = contatosNoFunil.length > 0 ? new Date(Math.max(...contatosNoFunil.map(c => new Date(c.created_at)))) : null;
        return { totalLeads, vendidos, taxaConversao, valorEmNegociacao, ultimoLead: ultimoLeadDate ? ultimoLeadDate.toLocaleDateString('pt-BR') : 'N/A', };
    }, [contatosNoFunil, colunasDoFunil]);

    const mutationOptions = {
        onSuccess: (message) => {
            toast.success(message || "Operação realizada com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['funilData', organizacaoId] });
            queryClient.invalidateQueries({ queryKey: ['availableProducts', selectedEmpreendimento, organizacaoId] });
        },
        onError: (error) => toast.error(error.message),
    };

    const updateContactColumnMutation = useMutation({
        mutationFn: async ({ contatoNoFunilId, novaColunaId }) => {
            const { colunasDoFunil: cols } = queryClient.getQueryData(['funilData', organizacaoId]);
            const novaColuna = cols.find(c => c.id === novaColunaId);
            if (novaColuna.nome === 'Vendido') {
                const contatoMovido = contatosNoFunil.find(c => c.id === contatoNoFunilId);
                const produtosParaVender = contatoMovido.produtos_interesse || [];
                if (produtosParaVender.length === 0) throw new Error("Nenhum produto associado para vender.");
                const novosContratos = produtosParaVender.map(item => ({ contato_id: contatoMovido.contatos.id, produto_id: item.produto.id, empreendimento_id: item.produto.empreendimento_id, valor_final_venda: item.produto.valor_venda_calculado || 0, status_contrato: 'Em assinatura', organizacao_id: organizacaoId }));
                const { error: contratoError } = await supabase.from('contratos').insert(novosContratos);
                if (contratoError) throw new Error(`Erro ao criar contratos: ${contratoError.message}`);
            }
            const { error } = await supabase.from('contatos_no_funil').update({ coluna_id: novaColunaId }).eq('id', contatoNoFunilId).eq('organizacao_id', organizacaoId);
            if (error) throw new Error(`Falha ao mover o contato: ${error.message}`);
            return "Contato movido com sucesso!";
        }, ...mutationOptions
    });
    
    const addContactMutation = useMutation({
        mutationFn: async (contactId) => {
            const { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funilId).eq('organizacao_id', organizacaoId).order('ordem').limit(1).single();
            if (!primeiraColuna) throw new Error("Coluna inicial não encontrada.");
            const { error } = await supabase.from('contatos_no_funil').insert({ contato_id: contactId, coluna_id: primeiraColuna.id, organizacao_id: organizacaoId });
            if (error) throw new Error(error.message);
            return "Contato adicionado ao funil!";
        },
        onSuccess: (message) => {
            setIsAddContactModalOpen(false);
            mutationOptions.onSuccess(message);
        },
        onError: mutationOptions.onError,
    });
    
    const createColumnMutation = useMutation({
        mutationFn: async (newColumnName) => {
            if (!funilId) throw new Error("ID do Funil não encontrado.");
            const newOrder = colunasDoFunil ? colunasDoFunil.length : 0;
            const { error } = await supabase.from('colunas_funil').insert({ nome: newColumnName, funil_id: funilId, ordem: newOrder, organizacao_id: organizacaoId });
            if (error) throw new Error(`Falha ao criar nova etapa: ${error.message}`);
            return "Nova etapa criada com sucesso!";
        }, ...mutationOptions
    });

    const reorderColumnsMutation = useMutation({
        mutationFn: async (reorderedColumns) => {
            const updates = reorderedColumns.map(column => supabase.from('colunas_funil').update({ ordem: column.ordem }).eq('id', column.id).eq('organizacao_id', organizacaoId));
            const results = await Promise.all(updates);
            const firstError = results.find(res => res.error);
            if (firstError) throw new Error(`Falha ao reordenar: ${firstError.error.message}`);
            return "Ordem das etapas salva!";
        }, ...mutationOptions
    });
    
    const deleteColumnCardsMutation = useMutation({
        mutationFn: async (columnId) => {
            const { error } = await supabase.from('contatos_no_funil').delete().eq('coluna_id', columnId).eq('organizacao_id', organizacaoId);
            if (error) throw new Error(`Falha ao excluir os cards: ${error.message}`);
            return "Cards da coluna excluídos permanentemente.";
        }, ...mutationOptions
    });
    
    const deleteCardMutation = useMutation({
        mutationFn: async (contatoNoFunilId) => {
            const { error } = await supabase.from('contatos_no_funil').delete().eq('id', contatoNoFunilId).eq('organizacao_id', organizacaoId);
            if (error) throw new Error(`Falha ao excluir o card: ${error.message}`);
            return "Card excluído com sucesso!";
        }, ...mutationOptions
    });

    const associateProductMutation = useMutation({
        mutationFn: async ({ contatoNoFunilId, productId }) => { const { error } = await supabase.from('contatos_no_funil_produtos').insert({ contato_no_funil_id: contatoNoFunilId, produto_id: productId, organizacao_id: organizacaoId }); if (error) throw new Error(error.message); return "Produto associado!"; }, ...mutationOptions
    });
    
    const dissociateProductMutation = useMutation({
        mutationFn: async (associationId) => { const { error } = await supabase.from('contatos_no_funil_produtos').delete().eq('id', associationId).eq('organizacao_id', organizacaoId); if (error) throw new Error(error.message); return "Produto removido!"; }, ...mutationOptions
    });

    const associateCorretorMutation = useMutation({ 
        mutationFn: async ({ contactId, corretorId }) => { const { error } = await supabase.from('contatos_no_funil').update({ corretor_id: corretorId }).eq('id', contactId).eq('organizacao_id', organizacaoId); if (error) throw error; return "Corretor associado!"; }, ...mutationOptions 
    });

    const [debounceTimeout, setDebounceTimeout] = useState(null);
    const handleSearch = (term) => { 
        clearTimeout(debounceTimeout); 
        if (!term.trim() || term.length < 2) { setSearchResults([]); return; } 
        setDebounceTimeout(setTimeout(async () => { 
            const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: term, p_organizacao_id: organizacaoId }); 
            setSearchResults(data || []); 
        }, 300)); 
    };
    
    const openAddContactModal = () => { setSearchResults([]); setIsAddContactModalOpen(true); };

    const handleStatusChange = (contactId, columnId) => {
        updateContactColumnMutation.mutate({ contatoNoFunilId: contactId, novaColunaId: columnId });
    };
    
    return (
        <div className="h-full flex flex-col bg-gray-100">
            <CrmDetalhesSidebar open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} funilEntry={selectedContactForSidebar} onAddActivity={(contato) => { setContactForNewActivity(contato); setIsActivityModalOpen(true); }} onEditActivity={(activity) => { setActivityToEdit(activity); setIsActivityModalOpen(true); }} onContactUpdate={() => queryClient.invalidateQueries({ queryKey: ['funilData', organizacaoId] })} refreshKey={sidebarRefreshKey} />
            {isActivityModalOpen && (<AtividadeModal isOpen={isActivityModalOpen} onClose={() => { setIsActivityModalOpen(false); setContactForNewActivity(null); setActivityToEdit(null); }} onActivityAdded={() => { if (isSidebarOpen) { setSidebarRefreshKey(prev => prev + 1); } }} activityToEdit={activityToEdit} initialContatoId={contactForNewActivity?.id} funcionarios={funcionarios} allEmpresas={empresas} />)}

            <div className="flex-shrink-0 bg-white shadow-sm p-4 space-y-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800">Funil de Vendas</h1>
                    <button onClick={openAddContactModal} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2">
                        <FontAwesomeIcon icon={faPlus} /> Adicionar Contato
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <KpiCard title="Total de Leads" value={kpiData.totalLeads} icon={faUsers} />
                    <KpiCard title="Leads Vendidos" value={kpiData.vendidos} icon={faHandshake} />
                    <KpiCard title="Taxa de Conversão" value={`${kpiData.taxaConversao.toFixed(1)}%`} icon={faPercent} />
                    <KpiCard title="Valor em Negociação" value={`R$ ${kpiData.valorEmNegociacao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={faSackDollar} />
                    <KpiCard title="Último Lead" value={kpiData.ultimoLead} icon={faCalendarDay} />
                </div>
            </div>

            <div className="flex-grow overflow-hidden p-4">
                {loadingFunil ? (
                    <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                ) : (
                    <FunilKanban
                        contatos={contatosNoFunil}
                        statusColumns={colunasDoFunil}
                        onStatusChange={handleStatusChange}
                        onCreateColumn={(newColumnName) => createColumnMutation.mutate(newColumnName)}
                        onAddContact={openAddContactModal}
                        onEditColumn={() => { /* Implementar editColumnMutation */ }}
                        onDeleteColumn={() => { /* Implementar deleteColumnMutation */ }}
                        onReorderColumns={(reorderedColumns) => reorderColumnsMutation.mutate(reorderedColumns)}
                        onOpenNotesModal={(funilId, contatoId) => { setCurrentContactFunilIdForNotes(funilId); setCurrentContactIdForNotes(contatoId); setIsNotesModalOpen(true); }}
                        availableProducts={availableProducts}
                        onAssociateProduct={(contatoNoFunilId, productId) => associateProductMutation.mutate({ contatoNoFunilId, productId })}
                        onDissociateProduct={(associationId) => dissociateProductMutation.mutate(associationId)}
                        onAssociateCorretor={(contactId, corretorId) => associateCorretorMutation.mutate({ contactId, corretorId })}
                        onCardClick={(entry) => { setSelectedContactForSidebar(entry); setIsSidebarOpen(true); }}
                        onAddActivity={(contato) => { setContactForNewActivity(contato); setIsActivityModalOpen(true); }}
                        sorting={sorting}
                        setSorting={setSorting}
                        userRole={userData?.funcoes?.nome_funcao}
                        onDeleteAllCardsInColumn={(columnId) => deleteColumnCardsMutation.mutate(columnId)}
                        onDeleteCard={(cardId) => deleteCardMutation.mutate(cardId)}
                    />
                )}
            </div>
            <AddContactModal isOpen={isAddContactModalOpen} onClose={() => setIsAddContactModalOpen(false)} onSearch={handleSearch} results={searchResults} onAddContact={(contactId) => addContactMutation.mutate(contactId)} existingContactIds={(contatosNoFunil || []).map(c => c.contatos?.id).filter(Boolean)} />
            <CrmNotesModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} contatoNoFunilId={currentContactFunilIdForNotes} contatoId={currentContactIdForNotes} />
        </div>
    );
}