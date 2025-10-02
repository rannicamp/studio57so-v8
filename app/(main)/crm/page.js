// app/(main)/crm/page.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faSearch, faPlus, faUsers, faHandshake, faPercent, faSackDollar, faCalendarDay } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { useDebounce } from 'use-debounce';

import FunilKanban from '@/components/crm/FunilKanban';
import CrmNotesModal from '@/components/crm/CrmNotesModal';
import CrmDetalhesSidebar from '@/components/crm/CrmDetalhesSidebar';
import AtividadeModal from '@/components/AtividadeModal';
import KpiCard from '@/components/KpiCard';
import FiltroCrm from '@/components/crm/FiltroCrm';

// =================================================================================
// INÍCIO DA OTIMIZAÇÃO DE PERFORMANCE (CACHE)
// O PORQUÊ: Esta chave identifica os dados do CRM no armazenamento local do navegador.
// =================================================================================
const CRM_CACHE_KEY = 'crmFunilData';

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
        contatos:contato_id ( *, telefones ( telefone, tipo ), emails(email, tipo) ),
        corretores:corretor_id (id, nome, razao_social),
        produtos_interesse:contatos_no_funil_produtos (id, produto:produtos_empreendimento (id, unidade, tipo, valor_venda_calculado, empreendimento_id))
    `);
    
    query = query.eq('organizacao_id', organizacaoId);

    if (filters.searchTerm) {
        query = query.or(`contatos.nome.ilike.%${filters.searchTerm}%,contatos.razao_social.ilike.%${filters.searchTerm}%,contatos.telefones.telefone.ilike.%${filters.searchTerm}%`);
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

    const { data: contatosNoFunilRaw, error: contatosError } = await query;
    if (contatosError) throw contatosError;

    let contatosFiltrados = contatosNoFunilRaw || [];
    if (filters.unidadeIds?.length > 0) {
        contatosFiltrados = contatosFiltrados.filter(item => {
            const unidadeIdsInteresse = (item.produtos_interesse || []).map(p => p.produto.id);
            return filters.unidadeIds.some(id => unidadeIdsInteresse.includes(id));
        });
    }

    const contatosParaEstado = contatosFiltrados.filter(item => item.contatos?.id);
    
    // A busca pela última mensagem de WhatsApp continua desativada para manter a performance.
    return { funilId, colunasDoFunil, contatosNoFunil: contatosParaEstado };
};

const fetchFilterData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { corretores: [], origens: [], unidades: [], campaigns: [], ads: [] };
    const { data: brokerIdsData, error: idsError } = await supabase.from('contatos_no_funil').select('corretor_id').eq('organizacao_id', organizacaoId).not('corretor_id', 'is', null);
    if (idsError) throw idsError;
    const uniqueBrokerIds = [...new Set(brokerIdsData.map(item => item.corretor_id))];
    let corretores = [];
    if (uniqueBrokerIds.length > 0) {
        const { data: corretoresData, error: corretoresError } = await supabase.from('contatos').select('id, nome, razao_social').in('id', uniqueBrokerIds).eq('organizacao_id', organizacaoId);
        if (corretoresError) throw corretoresError;
        corretores = corretoresData.map(c => ({ id: c.id, nome: c.nome || c.razao_social })).sort((a, b) => a.nome.localeCompare(b.nome));
    }
    const origensPromise = supabase.rpc('get_distinct_origens', { p_organizacao_id: organizacaoId });
    const unidadesPromise = supabase.from('produtos_empreendimento').select('id, unidade').eq('organizacao_id', organizacaoId).order('unidade');
    const campaignsPromise = supabase.from('meta_campaigns').select('id, name').eq('organizacao_id', organizacaoId).order('name');
    const adsPromise = supabase.from('meta_ads').select('id, name').eq('organizacao_id', organizacaoId).order('name');
    const [{ data: origensData }, { data: unidadesData }, { data: campaignsData }, { data: adsData }] = await Promise.all([origensPromise, unidadesPromise, campaignsPromise, adsPromise]);
    const origens = origensData.map(o => ({ id: o.origem, nome: o.origem }));
    const unidades = unidadesData.map(u => ({ id: u.id, nome: u.unidade }));
    const campaigns = campaignsData.map(c => ({ id: c.id, nome: c.name }));
    const ads = adsData.map(a => ({ id: a.id, nome: a.name }));
    return { corretores, origens, unidades, campaigns, ads };
};

const fetchAvailableProducts = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data, error } = await supabase.from('produtos_empreendimento').select('id, unidade, tipo, valor_venda_calculado, empreendimento_id').eq('status', 'Disponível').eq('organizacao_id', organizacaoId).order('unidade');
    if (error) throw new Error("Não foi possível carregar os produtos.");
    return data || [];
};

const fetchActivityModalData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { funcionarios: [], empresas: [] };
    const { data: funcionarios } = await supabase.from('funcionarios').select('id, full_name').eq('organizacao_id', organizacaoId).order('full_name');
    const { data: empresas } = await supabase.from('cadastro_empresa').select('id, razao_social').eq('organizacao_id', organizacaoId).order('razao_social');
    return { funcionarios, empresas };
};

// =================================================================================
// INÍCIO DA OTIMIZAÇÃO DE PERFORMANCE (CACHE)
// O PORQUÊ: Esta função lê os dados salvos no navegador para que a página
// carregue instantaneamente.
// =================================================================================
const getCachedFunilData = () => {
    try {
        const cachedData = localStorage.getItem(CRM_CACHE_KEY);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
    } catch (error) {
        console.error("Erro ao ler o cache do CRM:", error);
        localStorage.removeItem(CRM_CACHE_KEY); // Limpa o cache se estiver corrompido
    }
    return undefined; // Retorna undefined se não houver cache
};

export default function CrmPage() {
    const { setPageTitle } = useLayout();
    const { user, userData } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const supabase = createClient();
    const queryClient = useQueryClient();

    const [filters, setFilters] = useState({ searchTerm: '', corretorIds: [], origens: [], unidadeIds: [], campaignIds: [], adIds: [], startDate: '', endDate: new Date().toISOString().split('T')[0] });
    const [debouncedFilters] = useDebounce(filters, 500);

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

    // =================================================================================
    // INÍCIO DA OTIMIZAÇÃO DE PERFORMANCE (CACHE)
    // O PORQUÊ: `placeholderData` é usado para mostrar dados antigos enquanto os
    // novos são buscados em segundo plano. Isso faz a página parecer instantânea.
    // =================================================================================
    const { data: funilData, isLoading: loadingFunil, error: funilError } = useQuery({ 
        queryKey: ['funilData', organizacaoId, debouncedFilters], 
        queryFn: () => fetchFunilData(supabase, organizacaoId, debouncedFilters), 
        enabled: !!organizacaoId,
        placeholderData: getCachedFunilData(), // <-- MÁGICA ACONTECE AQUI!
    });
    const { funilId, colunasDoFunil = [], contatosNoFunil = [] } = funilData || {};

    // =================================================================================
    // INÍCIO DA OTIMIZAÇÃO DE PERFORMANCE (CACHE)
    // O PORQUÊ: Este efeito salva os dados mais recentes no navegador sempre que
    // eles são atualizados, garantindo que o próximo carregamento seja rápido.
    // =================================================================================
    useEffect(() => {
        if (funilData && !loadingFunil) { // Apenas salva se não estiver carregando e tiver dados
            try {
                // Não salva se os filtros estiverem ativos para não poluir o cache principal
                const hasActiveFilters = debouncedFilters.searchTerm || debouncedFilters.corretorIds.length > 0 || debouncedFilters.origens.length > 0 || debouncedFilters.unidadeIds.length > 0 || debouncedFilters.campaignIds.length > 0 || debouncedFilters.adIds.length > 0 || debouncedFilters.startDate;
                if (!hasActiveFilters) {
                    localStorage.setItem(CRM_CACHE_KEY, JSON.stringify(funilData));
                }
            } catch (error) {
                console.error("Erro ao salvar o cache do CRM:", error);
            }
        }
    }, [funilData, loadingFunil, debouncedFilters]);


    const { data: filterOptions, isLoading: loadingFilters } = useQuery({ queryKey: ['crmFilterOptions', organizacaoId], queryFn: () => fetchFilterData(supabase, organizacaoId), enabled: !!organizacaoId });
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
        
        return { 
            totalLeads, 
            vendidos, 
            taxaConversao, 
            valorEmNegociacao, 
            ultimoLead: ultimoLeadDate ? formatRelativeDate(ultimoLeadDate) : 'N/A', 
        };
    }, [contatosNoFunil, colunasDoFunil]);

    const mutationOptions = { onSuccess: (message) => { toast.success(message || "Operação realizada com sucesso!"); queryClient.invalidateQueries({ queryKey: ['funilData', organizacaoId, debouncedFilters] }); queryClient.invalidateQueries({ queryKey: ['availableProducts', organizacaoId] }); queryClient.invalidateQueries({ queryKey: ['crmFilterOptions', organizacaoId] }); }, onError: (error) => toast.error(error.message) };
    const associateProductMutation = useMutation({ mutationFn: async ({ contatoNoFunilId, productId }) => { if (!organizacaoId) { throw new Error("ID da organização não encontrado. Tente novamente."); } await supabase.from('contatos_no_funil_produtos').insert({ contato_no_funil_id: contatoNoFunilId, produto_id: productId, organizacao_id: organizacaoId }).throwOnError(); return "Produto associado!"; }, ...mutationOptions });
    const updateContactColumnMutation = useMutation({ mutationFn: async ({ contatoNoFunilId, novaColunaId }) => { const { colunasDoFunil: cols } = queryClient.getQueryData(['funilData', organizacaoId, debouncedFilters]); const novaColuna = cols.find(c => c.id === novaColunaId); if (novaColuna.nome === 'Vendido') { const contatoMovido = contatosNoFunil.find(c => c.id === contatoNoFunilId); const produtosParaVender = contatoMovido.produtos_interesse || []; if (produtosParaVender.length === 0) throw new Error("Nenhum produto associado para vender."); const novosContratos = produtosParaVender.map(item => ({ contato_id: contatoMovido.contatos.id, produto_id: item.produto.id, empreendimento_id: item.produto.empreendimento_id, valor_final_venda: item.produto.valor_venda_calculado || 0, status_contrato: 'Em assinatura', organizacao_id: organizacaoId })); await supabase.from('contratos').insert(novosContratos).throwOnError(); } await supabase.from('contatos_no_funil').update({ coluna_id: novaColunaId }).eq('id', contatoNoFunilId).eq('organizacao_id', organizacaoId).throwOnError(); return "Contato movido!"; }, ...mutationOptions });
    const addContactMutation = useMutation({ mutationFn: async (contactId) => { const { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funilId).eq('organizacao_id', organizacaoId).order('ordem').limit(1).single(); if (!primeiraColuna) throw new Error("Coluna inicial não encontrada."); await supabase.from('contatos_no_funil').insert({ contato_id: contactId, coluna_id: primeiraColuna.id, organizacao_id: organizacaoId }).throwOnError(); return "Contato adicionado!"; }, onSuccess: (message) => { setIsAddContactModalOpen(false); mutationOptions.onSuccess(message); }, onError: mutationOptions.onError });
    const createColumnMutation = useMutation({ mutationFn: async (name) => { await supabase.from('colunas_funil').insert({ nome: name, funil_id: funilId, ordem: colunasDoFunil.length, organizacao_id: organizacaoId }).throwOnError(); return "Etapa criada!"; }, ...mutationOptions });
    const reorderColumnsMutation = useMutation({ mutationFn: async (cols) => { const updates = cols.map(c => supabase.from('colunas_funil').update({ ordem: c.ordem }).eq('id', c.id)); await Promise.all(updates); return "Ordem salva!"; }, ...mutationOptions });
    const deleteColumnCardsMutation = useMutation({ mutationFn: async (colId) => { await supabase.from('contatos_no_funil').delete().eq('coluna_id', colId).throwOnError(); return "Cards excluídos!"; }, ...mutationOptions });
    const deleteCardMutation = useMutation({ mutationFn: async (cardId) => { await supabase.from('contatos_no_funil').delete().eq('id', cardId).throwOnError(); return "Card excluído!"; }, ...mutationOptions });
    const dissociateProductMutation = useMutation({ mutationFn: async (id) => { await supabase.from('contatos_no_funil_produtos').delete().eq('id', id).throwOnError(); return "Produto removido!"; }, ...mutationOptions });
    const associateCorretorMutation = useMutation({ mutationFn: async ({ contactId, corretorId }) => { await supabase.from('contatos_no_funil').update({ corretor_id: corretorId }).eq('id', contactId).throwOnError(); return "Corretor associado!"; }, ...mutationOptions });
    
    const [debounceSearchTimeout, setDebounceSearchTimeout] = useState(null);
    const handleSearch = (term) => { clearTimeout(debounceSearchTimeout); if (!term.trim() || term.length < 2) { setSearchResults([]); return; } setDebounceSearchTimeout(setTimeout(async () => { const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: term, p_organizacao_id: organizacaoId }); setSearchResults(data || []); }, 300)); };
    const openAddContactModal = () => { setSearchResults([]); setIsAddContactModalOpen(true); };
    const handleStatusChange = (contactId, columnId) => updateContactColumnMutation.mutate({ contatoNoFunilId: contactId, novaColunaId: columnId });
    
    return (
        <div className="h-full flex flex-col bg-gray-100">
            <CrmDetalhesSidebar open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} funilEntry={selectedContactForSidebar} onAddActivity={(c) => { setContactForNewActivity(c); setIsActivityModalOpen(true); }} onEditActivity={(a) => { setActivityToEdit(a); setIsActivityModalOpen(true); }} onContactUpdate={() => queryClient.invalidateQueries({ queryKey: ['funilData', organizacaoId, debouncedFilters] })} refreshKey={sidebarRefreshKey} />
            {isActivityModalOpen && (<AtividadeModal isOpen={isActivityModalOpen} onClose={() => { setIsActivityModalOpen(false); setContactForNewActivity(null); setActivityToEdit(null); }} onActivityAdded={() => { if (isSidebarOpen) setSidebarRefreshKey(p => p + 1); }} activityToEdit={activityToEdit} initialContatoId={contactForNewActivity?.id} funcionarios={funcionarios} allEmpresas={empresas} />)}

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

            <div className="flex-grow overflow-y-auto p-4 flex flex-col">
                <FiltroCrm
                    filters={filters}
                    setFilters={setFilters}
                    corretores={filterOptions?.corretores}
                    unidades={filterOptions?.unidades}
                    origens={filterOptions?.origens}
                    campaigns={filterOptions?.campaigns}
                    ads={filterOptions?.ads}
                />
                
                {/* O spinner agora só aparece no primeiro carregamento, se não houver cache */}
                {loadingFunil && !funilData ? (
                    <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                ) : (
                    <FunilKanban
                        contatos={contatosNoFunil}
                        statusColumns={colunasDoFunil}
                        onStatusChange={handleStatusChange}
                        onCreateColumn={(name) => createColumnMutation.mutate(name)}
                        onAddContact={openAddContactModal}
                        onEditColumn={() => {}}
                        onDeleteColumn={() => {}}
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
                    />
                )}
            </div>
            <AddContactModal isOpen={isAddContactModalOpen} onClose={() => setIsAddContactModalOpen(false)} onSearch={handleSearch} results={searchResults} onAddContact={(id) => addContactMutation.mutate(id)} existingContactIds={(contatosNoFunil || []).map(c => c.contatos?.id).filter(Boolean)} />
            <CrmNotesModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} contatoNoFunilId={currentContactFunilIdForNotes} contatoId={currentContactIdForNotes} />
        </div>
    );
}