// app/(main)/crm/page.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faTimes, faSearch, faPlus, faUsers, faHandshake, 
    faPercent, faSackDollar, faCalendarDay, faRobot, faFilter, faLayerGroup,
    faTable // <--- Novo ícone para o botão de Mapeamento
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { useDebounce } from 'use-debounce';

import FunilKanban from '@/components/crm/FunilKanban';
import CrmNotesModal from '@/components/crm/CrmNotesModal';
import CrmDetalhesSidebar from '@/components/crm/CrmDetalhesSidebar';
import AtividadeModal from '@/components/atividades/AtividadeModal';
import KpiCard from '@/components/shared/KpiCard';
import FiltroCrm from '@/components/crm/FiltroCrm';
import NewConversationModal from '@/components/whatsapp/NewConversationModal';
import MetaFormMappingModal from '@/components/crm/MetaFormMappingModal'; // <--- Importação do Novo Modal

// --- CHAVE ÚNICA PARA O LOCALSTORAGE (PERSISTÊNCIA) ---
const CRM_UI_STATE_KEY = 'STUDIO57_CRM_UI_STATE_V1';

const getCachedUiState = () => {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(CRM_UI_STATE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
};

const formatRelativeDate = (date) => {
    if (!date) return 'N/A';
    const today = startOfDay(new Date());
    const leadDate = startOfDay(new Date(date));
    const diff = differenceInCalendarDays(today, leadDate);

    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    if (diff === 2) return 'Anteontem';
    return `Há ${diff} dias`;
};

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${'}'}()|[\]\\]/g, '\\$&')})`, 'gi');
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

const fetchFunilData = async (supabase, organizacaoId, filters) => {
    if (!organizacaoId) return { funilId: null, colunasDoFunil: [], contatosNoFunil: [] };

    const { data: funilData } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').eq('organizacao_id', organizacaoId).single();
    const funilId = funilData?.id;
    if (!funilId) return { funilId: null, colunasDoFunil: [], contatosNoFunil: [] };
    
    const { data: colunasDoFunil, error: colunasError } = await supabase.from('colunas_funil').select('id, nome, ordem').eq('funil_id', funilId).eq('organizacao_id', organizacaoId).order('ordem', { ascending: true });
    if (colunasError) throw colunasError;
    if (!colunasDoFunil || colunasDoFunil.length === 0) return { funilId, colunasDoFunil: [], contatosNoFunil: [] };
    
    let query = supabase.from('contatos_no_funil').select(`
        id, coluna_id, numero_card, corretor_id, created_at,
        contatos:contato_id!inner(*, telefones(telefone, tipo), emails(email, tipo)),
        corretores:corretor_id(id, nome, razao_social),
        produtos_interesse:contatos_no_funil_produtos(id, produto:produtos_empreendimento(id, unidade, tipo, valor_venda_calculado, empreendimento_id))
    `);
    
    query = query.eq('organizacao_id', organizacaoId);

    if (filters.searchTerm) {
        query = query.or(`nome.ilike.%${filters.searchTerm}%,razao_social.ilike.%${filters.searchTerm}%`, { foreignTable: 'contatos' });
    }
    if (filters.corretorIds?.length > 0) {
        query = query.in('corretor_id', filters.corretorIds);
    }
    if (filters.origens?.length > 0) {
        query = query.in('contatos.origem', filters.origens);
    }
    if (filters.campaignIds?.length > 0) {
        query = query.in('contatos.meta_campaign_id', filters.campaignIds);
    }
    if (filters.adIds?.length > 0) {
        query = query.in('contatos.meta_ad_id', filters.adIds);
    }
    if (filters.startDate) {
        query = query.gte('created_at', filters.startDate + 'T00:00:00');
    }
    if (filters.endDate) {
        query = query.lte('created_at', filters.endDate + 'T23:59:59');
    }

    if (filters.unidadeIds?.length > 0) {
        const { data: funilProductLinks, error: linkError } = await supabase
            .from('contatos_no_funil_produtos')
            .select('contato_no_funil_id')
            .in('produto_id', filters.unidadeIds);
        if (linkError) throw linkError;
        const matchingFunilIds = (funilProductLinks || []).map(link => link.contato_no_funil_id);
        if (matchingFunilIds.length === 0) {
             return { funilId, colunasDoFunil, contatosNoFunil: [] };
        }
        query = query.in('id', matchingFunilIds);
    }

    const { data: contatosNoFunilRaw, error: contatosError } = await query;
    if (contatosError) throw contatosError;

    const contatosParaEstado = (contatosNoFunilRaw || []).filter(item => item.contatos?.id);
    
    return { funilId, colunasDoFunil, contatosNoFunil: contatosParaEstado };
};

const fetchFilterData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { corretores: [], origens: [], unidades: [], campaigns: [], ads: [] };

    const corretoresIdsPromise = supabase.from('contatos_no_funil').select('corretor_id').eq('organizacao_id', organizacaoId).not('corretor_id', 'is', null);
    const unidadesPromise = supabase.from('produtos_empreendimento').select('id, unidade, tipo').eq('organizacao_id', organizacaoId).order('unidade');
    const contatosDataPromise = supabase.from('contatos').select('origem, meta_campaign_id, meta_campaign_name, meta_ad_id, meta_ad_name').eq('organizacao_id', organizacaoId);

    const [{ data: corretoresIdsData }, { data: unidadesData }, { data: contatosParaFiltro }] = await Promise.all([corretoresIdsPromise, unidadesPromise, contatosDataPromise]);

    const uniqueCorretorIds = [...new Set((corretoresIdsData || []).map(c => c.corretor_id))];
    let corretores = [];
    if (uniqueCorretorIds.length > 0) {
        const { data } = await supabase.from('contatos').select('id, nome, razao_social').in('id', uniqueCorretorIds);
        corretores = (data || []).map(c => ({ id: c.id, nome: c.nome || c.razao_social })).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }

    const unidades = (unidadesData || []).map(u => ({ id: u.id, nome: `${u.unidade} (${u.tipo || 'N/A'})` }));
    const origens = [...new Set((contatosParaFiltro || []).map(c => c.origem).filter(Boolean))].map(o => ({ id: o, nome: o })).sort((a, b) => a.nome.localeCompare(b.nome));
    const campaigns = [...new Map((contatosParaFiltro || []).filter(c => c.meta_campaign_id && c.meta_campaign_name).map(c => [c.meta_campaign_id, { id: c.meta_campaign_id, nome: c.meta_campaign_name }])) .values()].sort((a, b) => a.nome.localeCompare(b.nome));
    const ads = [...new Map((contatosParaFiltro || []).filter(c => c.meta_ad_id && c.meta_ad_name).map(c => [c.meta_ad_id, { id: c.meta_ad_id, nome: c.meta_ad_name }])) .values()].sort((a, b) => a.nome.localeCompare(b.nome));

    return { corretores, origens, unidades, campaigns, ads };
};

const fetchAvailableProducts = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data } = await supabase.from('produtos_empreendimento').select('id, unidade, tipo, valor_venda_calculado, empreendimento_id').eq('status', 'Disponível').eq('organizacao_id', organizacaoId).order('unidade');
    return data || [];
};

const fetchActivityModalData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { funcionarios: [], empresas: [] };
    const { data: funcionarios } = await supabase.from('funcionarios').select('id, full_name').eq('organizacao_id', organizacaoId).order('full_name');
    const { data: empresas } = await supabase.from('cadastro_empresa').select('id, razao_social').eq('organizacao_id', organizacaoId).order('razao_social');
    return { funcionarios, empresas };
};

export default function CrmPage() {
    const { setPageTitle } = useLayout();
    const { user, userData } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // CORREÇÃO: createClient síncrono para Client Component
    const supabase = createClient();
    const queryClient = useQueryClient();

    // Estado Persistente
    const cachedState = getCachedUiState();
    const defaultFilters = { searchTerm: '', corretorIds: [], origens: [], unidadeIds: [], campaignIds: [], adIds: [], startDate: '', endDate: new Date().toISOString().split('T')[0] };

    const [filters, setFilters] = useState(cachedState?.filters || defaultFilters);
    const [sorting, setSorting] = useState(cachedState?.sorting || {});
    // Novo estado para controlar a visibilidade dos filtros
    const [showFilters, setShowFilters] = useState(false); 
    
    const [debouncedFilters] = useDebounce(filters, 500);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(CRM_UI_STATE_KEY, JSON.stringify({ filters, sorting }));
        }
    }, [filters, sorting]);

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

    // --- ESTADOS PARA O MODAL DO WHATSAPP ---
    const [isWhatsModalOpen, setIsWhatsModalOpen] = useState(false);
    const [contactForWhats, setContactForWhats] = useState(null);

    // --- ESTADOS PARA O MODAL DE MAPEAMENTO META ---
    const [isMetaMappingOpen, setIsMetaMappingOpen] = useState(false);

    useEffect(() => { if (setPageTitle) setPageTitle("CRM - Funil de Vendas"); }, [setPageTitle]);

    const { data: funilData, isLoading: loadingFunil, error: funilError } = useQuery({ 
        queryKey: ['funilData', organizacaoId, debouncedFilters], 
        queryFn: () => fetchFunilData(supabase, organizacaoId, debouncedFilters), 
        enabled: !!organizacaoId,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        refetchOnWindowFocus: true,
    });
    
    const { funilId, colunasDoFunil = [], contatosNoFunil = [] } = funilData || {};

    const { data: filterOptions } = useQuery({ queryKey: ['crmFilterOptions', organizacaoId], queryFn: () => fetchFilterData(supabase, organizacaoId), enabled: !!organizacaoId, staleTime: 1000 * 60 * 15 });
    const { data: availableProducts = [] } = useQuery({ queryKey: ['availableProducts', organizacaoId], queryFn: () => fetchAvailableProducts(supabase, organizacaoId), enabled: !!organizacaoId });
    const { data: activityData } = useQuery({ queryKey: ['activityModalData', organizacaoId], queryFn: () => fetchActivityModalData(supabase, organizacaoId), enabled: !!organizacaoId });
    const { funcionarios = [], empresas = [] } = activityData || {};
    
    if (funilError) { toast.error(`Erro ao carregar dados do funil: ${funilError.message}`); }
    
    const kpiData = useMemo(() => {
        const dataToAnalyze = contatosNoFunil; 
        if (!colunasDoFunil || dataToAnalyze.length === 0) return { totalLeads: 0, vendidos: 0, taxaConversao: 0, valorEmNegociacao: 0, ultimoLead: 'N/A' };
        const colunaVendido = colunasDoFunil.find(c => c.nome.toLowerCase() === 'vendido');
        const totalLeads = dataToAnalyze.length;
        const vendidos = dataToAnalyze.filter(c => c.coluna_id === colunaVendido?.id).length;
        const taxaConversao = totalLeads > 0 ? (vendidos / totalLeads) * 100 : 0;
        const valorEmNegociacao = dataToAnalyze.filter(contato => { const colunaDoContato = colunasDoFunil.find(c => c.id === contato.coluna_id); return colunaDoContato && colunaVendido && colunaDoContato.ordem < (colunaVendido.ordem || -1); }).reduce((acc, contato) => { const valorProdutos = (contato.produtos_interesse || []).reduce((sum, item) => sum + (item.produto?.valor_venda_calculado || 0), 0); return acc + valorProdutos; }, 0);
        const ultimoLeadDate = dataToAnalyze.length > 0 ? new Date(Math.max(...dataToAnalyze.map(c => new Date(c.created_at)))) : null;
        
        return { totalLeads, vendidos, taxaConversao, valorEmNegociacao, ultimoLead: ultimoLeadDate ? formatRelativeDate(ultimoLeadDate) : 'N/A' };
    }, [contatosNoFunil, colunasDoFunil]);

    const mutationOptions = { onSuccess: (message) => { toast.success(message || "Operação realizada com sucesso!"); queryClient.invalidateQueries({ queryKey: ['funilData', organizacaoId, debouncedFilters] }); queryClient.invalidateQueries({ queryKey: ['availableProducts', organizacaoId] }); queryClient.invalidateQueries({ queryKey: ['crmFilterOptions', organizacaoId] }); }, onError: (error) => toast.error(error.message) };
    const associateProductMutation = useMutation({ mutationFn: async ({ contatoNoFunilId, productId }) => { if (!organizacaoId) { throw new Error("ID da organização não encontrado. Tente novamente."); } await supabase.from('contatos_no_funil_produtos').insert({ contato_no_funil_id: contatoNoFunilId, produto_id: productId, organizacao_id: organizacaoId }).throwOnError(); return "Produto associado!"; }, ...mutationOptions });
    
    const handleStatusChangeMutation = useMutation({
        mutationFn: async ({ contatoNoFunilId, newColumnId }) => {
            const { data: currentEntry, error: fetchError } = await supabase.from('contatos_no_funil').select('coluna_id').eq('id', contatoNoFunilId).single();
            if (fetchError) throw new Error(fetchError.message || "Card não encontrado para mover.");
            if (!currentEntry) throw new Error("Card não encontrado.");
            const oldColumnId = currentEntry.coluna_id;
            if (oldColumnId === newColumnId) return "O card já está nesta etapa.";
            const { error: updateError } = await supabase.from('contatos_no_funil').update({ coluna_id: newColumnId }).eq('id', contatoNoFunilId);
            if (updateError) throw updateError;
            
            fetch('/api/crm', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contatoNoFunilId, novaColunaId: newColumnId, organizacaoId }) }).catch(err => console.error("Erro background automação:", err));
            const { error: historyError } = await supabase.from('historico_movimentacao_funil').insert({ contato_no_funil_id: contatoNoFunilId, coluna_anterior_id: oldColumnId, coluna_nova_id: newColumnId, usuario_id: user.id, organizacao_id: organizacaoId });
            if (historyError) { console.error("Erro ao registrar histórico de movimentação:", historyError); }
            return "Card movido com sucesso!";
        },
        onSuccess: (message) => { toast.success(message); queryClient.invalidateQueries({ queryKey: ['funilData', organizacaoId, debouncedFilters] }); },
        onError: (error) => { toast.error(`Erro ao mover o card: ${error.message}`); }
    });

    const addContactMutation = useMutation({ mutationFn: async (contactId) => { const { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funilId).eq('organizacao_id', organizacaoId).order('ordem').limit(1).single(); if (!primeiraColuna) throw new Error("Coluna inicial não encontrada."); await supabase.from('contatos_no_funil').insert({ contato_id: contactId, coluna_id: primeiraColuna.id, organizacao_id: organizacaoId }).throwOnError(); return "Contato adicionado!"; }, onSuccess: (message) => { setIsAddContactModalOpen(false); mutationOptions.onSuccess(message); }, onError: mutationOptions.onError });
    const createColumnMutation = useMutation({ mutationFn: async (name) => { await supabase.from('colunas_funil').insert({ nome: name, funil_id: funilId, ordem: colunasDoFunil.length, organizacao_id: organizacaoId }).throwOnError(); return "Etapa criada!"; }, ...mutationOptions });
    const reorderColumnsMutation = useMutation({ mutationFn: async (cols) => { const updates = cols.map(c => supabase.from('colunas_funil').update({ ordem: c.ordem }).eq('id', c.id)); await Promise.all(updates); return "Ordem salva!"; }, ...mutationOptions });
    const deleteColumnCardsMutation = useMutation({ mutationFn: async (colId) => { await supabase.from('contatos_no_funil').delete().eq('coluna_id', colId).throwOnError(); return "Cards excluídos!"; }, ...mutationOptions });
    const deleteCardMutation = useMutation({ mutationFn: async (cardId) => { await supabase.from('contatos_no_funil').delete().eq('id', cardId).throwOnError(); return "Card excluído!"; }, ...mutationOptions });
    const dissociateProductMutation = useMutation({ mutationFn: async (id) => { await supabase.from('contatos_no_funil_produtos').delete().eq('id', id).throwOnError(); return "Produto removido!"; }, ...mutationOptions });
    const associateCorretorMutation = useMutation({ mutationFn: async ({ contactId, corretorId }) => { await supabase.from('contatos_no_funil').update({ corretor_id: corretorId }).eq('id', contactId).throwOnError(); return "Corretor associado!"; }, ...mutationOptions });
    const editColumnMutation = useMutation({ mutationFn: async ({ columnId, newName }) => { const { error } = await supabase.from('colunas_funil').update({ nome: newName }).eq('id', columnId).eq('organizacao_id', organizacaoId); if (error) throw error; return "Nome da etapa atualizado!"; }, ...mutationOptions });
    const deleteColumnMutation = useMutation({ mutationFn: async (columnIdToDelete) => { const { data: firstColumn, error: firstColumnError } = await supabase.from('colunas_funil').select('id').eq('funil_id', funilId).eq('organizacao_id', organizacaoId).order('ordem', { ascending: true }).limit(1).single(); if (firstColumnError || !firstColumn) throw new Error('Não foi possível encontrar a coluna de destino para os contatos.'); if (columnIdToDelete === firstColumn.id) throw new Error('Não é possível excluir a primeira coluna do funil.'); const { error: moveError } = await supabase.from('contatos_no_funil').update({ coluna_id: firstColumn.id }).eq('coluna_id', columnIdToDelete); if (moveError) throw new Error(`Erro ao mover os contatos: ${moveError.message}`); const { error: deleteError } = await supabase.from('colunas_funil').delete().eq('id', columnIdToDelete); if (deleteError) throw new Error(`Erro ao excluir a coluna: ${deleteError.message}`); return "Etapa excluída! Os contatos foram movidos para a primeira etapa."; }, ...mutationOptions });

    const [debounceSearchTimeout, setDebounceSearchTimeout] = useState(null);
    const handleSearch = (term) => { clearTimeout(debounceSearchTimeout); if (!term.trim() || term.length < 2) { setSearchResults([]); return; } setDebounceSearchTimeout(setTimeout(async () => { const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: term, p_organizacao_id: organizacaoId }); setSearchResults(data || []); }, 300)); };
    const openAddContactModal = () => { setSearchResults([]); setIsAddContactModalOpen(true); };
    const handleStatusChange = (contactId, columnId) => handleStatusChangeMutation.mutate({ contatoNoFunilId: contactId, newColumnId: columnId });
    
    // --- FUNÇÃO PARA INICIAR WHATSAPP ---
    const handleStartWhatsApp = (entry) => {
        const contact = entry.contatos;
        if (!contact) return;

        // Pega o telefone (tenta array ou campo direto)
        const phone = contact.telefones?.[0]?.telefone || contact.telefones?.[0] || contact.telefone;

        if (!phone) {
             toast.error("Este contato não possui telefone cadastrado.");
             return;
        }

        // Prepara o objeto para o Modal (formato esperado)
        setContactForWhats({
            id: contact.id,
            nome: contact.nome || contact.razao_social || 'Cliente',
            telefones: [{ telefone: phone }] 
        });
        setIsWhatsModalOpen(true);
    };

    return (
        <div className="h-full flex flex-col bg-gray-100">
            <CrmDetalhesSidebar open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} funilEntry={selectedContactForSidebar} onAddActivity={(c) => { setContactForNewActivity(c); setIsActivityModalOpen(true); }} onEditActivity={(a) => { setActivityToEdit(a); setIsActivityModalOpen(true); }} onContactUpdate={() => queryClient.invalidateQueries({ queryKey: ['funilData', organizacaoId, debouncedFilters] })} refreshKey={sidebarRefreshKey} />
            {isActivityModalOpen && (<AtividadeModal isOpen={isActivityModalOpen} onClose={() => { setIsActivityModalOpen(false); setContactForNewActivity(null); setActivityToEdit(null); }} onActivityAdded={() => { if (isSidebarOpen) setSidebarRefreshKey(p => p + 1); }} activityToEdit={activityToEdit} initialContatoId={contactForNewActivity?.id} funcionarios={funcionarios} allEmpresas={empresas} />)}

            <div className="flex-shrink-0 bg-white shadow-sm p-6 space-y-6">
                {/* HEADLINE E FERRAMENTAS - Layout inspirado na página de contatos */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-gray-800">Funil de Vendas</h1>
                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-2">
                            {kpiData.totalLeads} leads
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                        {/* Barra de Busca Integrada */}
                        <div className="relative flex-grow xl:flex-grow-0 min-w-[200px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Buscar no funil..." 
                                value={filters.searchTerm} 
                                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))} 
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                        </div>

                        {/* Botão de Filtro Toggle */}
                        <button 
                            onClick={() => setShowFilters(!showFilters)} 
                            className={`border font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                            title="Filtros Avançados"
                        >
                            <FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500 mr-2" : "text-gray-500 mr-2"} />
                            Filtros
                        </button>

                        {/* BOTÃO NOVO: Mapear Meta */}
                        <button 
                            onClick={() => setIsMetaMappingOpen(true)}
                            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200"
                            title="Mapear Campos do Formulário Meta"
                        >
                            <FontAwesomeIcon icon={faTable} className="text-blue-600 mr-2" />
                            Mapear Meta
                        </button>

                        <Link href="/crm/automacao" className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200">
                            <FontAwesomeIcon icon={faRobot} className="text-purple-500 mr-2" /> Automações
                        </Link>
                        
                        <button onClick={openAddContactModal} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200">
                            <FontAwesomeIcon icon={faPlus} className="mr-2" /> Novo Lead
                        </button>
                    </div>
                </div>

                {/* PAINEL DE FILTROS - Aparece apenas quando showFilters é true */}
                {showFilters && (
                    <FiltroCrm
                        filters={filters}
                        setFilters={setFilters}
                        corretores={filterOptions?.corretores}
                        unidades={filterOptions?.unidades}
                        origens={filterOptions?.origens}
                        campaigns={filterOptions?.campaigns}
                        ads={filterOptions?.ads}
                    />
                )}

                {/* KPIs - Design mais limpo e cards menores para economizar espaço */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
                    <KpiCard title="Total" value={kpiData.totalLeads} icon={faUsers} />
                    <KpiCard title="Vendidos" value={kpiData.vendidos} icon={faHandshake} />
                    <KpiCard title="Conversão" value={`${kpiData.taxaConversao.toFixed(1)}%`} icon={faPercent} />
                    <KpiCard title="Em Negociação" value={`R$ ${kpiData.valorEmNegociacao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={faSackDollar} />
                    <KpiCard title="Último Lead" value={kpiData.ultimoLead} icon={faCalendarDay} />
                </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4 flex flex-col">
                {loadingFunil && !funilData ? (
                    <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" /></div>
                ) : (
                    <FunilKanban
                        contatos={contatosNoFunil}
                        statusColumns={colunasDoFunil}
                        onStatusChange={handleStatusChange}
                        onCreateColumn={(name) => createColumnMutation.mutate(name)}
                        onAddContact={openAddContactModal}
                        onEditColumn={(id, name) => editColumnMutation.mutate({ columnId: id, newName: name })}
                        onDeleteColumn={(id) => deleteColumnMutation.mutate(id)}
                        onReorderColumns={(cols) => reorderColumnsMutation.mutate(cols)}
                        onOpenNotesModal={(funilId, contatoId) => { setCurrentContactFunilIdForNotes(funilId); setCurrentContactIdForNotes(contatoId); setIsNotesModalOpen(true); }}
                        availableProducts={availableProducts}
                        onAssociateProduct={(contatoNoFunilId, productId) => associateProductMutation.mutate({ contatoNoFunilId, productId })}
                        onDissociateProduct={(id) => dissociateProductMutation.mutate(id)}
                        onAssociateCorretor={(contactId, corretorId) => associateCorretorMutation.mutate({ contactId, corretorId })}
                        onCardClick={(entry) => { setSelectedContactForSidebar(entry); setIsSidebarOpen(true); }}
                        onAddActivity={(c) => { setContactForNewActivity(c); setIsActivityModalOpen(true); }}
                        sorting={sorting}
                        setSorting={setSorting}
                        userRole={userData?.funcoes?.nome_funcao}
                        onDeleteAllCardsInColumn={(id) => deleteColumnCardsMutation.mutate(id)}
                        onDeleteCard={(id) => deleteCardMutation.mutate(id)}
                        onStartWhatsApp={handleStartWhatsApp} 
                    />
                )}
            </div>
            <AddContactModal isOpen={isAddContactModalOpen} onClose={() => setIsAddContactModalOpen(false)} onSearch={handleSearch} results={searchResults} onAddContact={(id) => addContactMutation.mutate(id)} existingContactIds={(contatosNoFunil || []).map(c => c.contatos?.id).filter(Boolean)} />
            <CrmNotesModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} contatoNoFunilId={currentContactFunilIdForNotes} contatoId={currentContactIdForNotes} />
            
            {/* Modal do WhatsApp */}
            <NewConversationModal
                isOpen={isWhatsModalOpen}
                onClose={() => setIsWhatsModalOpen(false)}
                preSelectedContact={contactForWhats}
            />

            {/* Modal de Mapeamento do Meta */}
            <MetaFormMappingModal
                isOpen={isMetaMappingOpen}
                onClose={() => setIsMetaMappingOpen(false)}
                organizacaoId={organizacaoId}
            />
        </div>
    );
}