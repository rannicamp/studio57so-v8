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
    faTable
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
import MetaFormMappingModal from '@/components/crm/MetaFormMappingModal';

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
    return (<span> {parts.map((part, i) => regex.test(part) ? (<mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark>) : (<span key={i}>{part}</span>))} </span>);
};

const AddContactModal = ({ isOpen, onClose, onSearch, results, onAddContact, existingContactIds }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const handleInputChange = (e) => { const term = e.target.value; setSearchTerm(term); onSearch(term); };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
                {/* Header padrão azul */}
                <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
                    <h3 className="text-base font-bold flex items-center gap-2">
                        <FontAwesomeIcon icon={faUsers} />
                        Adicionar Contato ao Funil
                    </h3>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10" title="Fechar">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
                {/* Busca */}
                <div className="p-6 space-y-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faSearch} className="text-gray-400 text-sm" />
                        </div>
                        <input
                            type="text"
                            placeholder="Pesquisar por nome, empresa, CPF ou CNPJ..."
                            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                            value={searchTerm}
                            onChange={handleInputChange}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 rounded-md border border-gray-200">
                        {results.length === 0 && (
                            <p className="text-sm text-gray-400 font-medium text-center py-8">Digite para buscar contatos...</p>
                        )}
                        {results.map(contact => {
                            const isAlreadyInFunnel = existingContactIds.includes(contact.id);
                            return (
                                <div key={contact.id} className="flex justify-between items-center px-4 py-3 hover:bg-gray-50">
                                    <span className="text-sm font-medium text-gray-800">
                                        <HighlightedText text={contact.nome || contact.razao_social} highlight={searchTerm} />
                                    </span>
                                    <button
                                        onClick={() => onAddContact(contact.id)}
                                        disabled={isAlreadyInFunnel}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${isAlreadyInFunnel
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                            }`}
                                    >
                                        {isAlreadyInFunnel ? 'Já no Funil' : <><FontAwesomeIcon icon={faPlus} className="mr-1" />Adicionar</>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- LÓGICA DE BUSCA DO FUNIL (ISOLAMENTO POR ORGANIZAÇÃO) ---
const fetchFunilData = async (supabase, organizacaoId, funilId, filters) => {
    if (!organizacaoId || !funilId) return { colunasDoFunil: [], contatosNoFunil: [] };

    // 1. Busca TODAS as Colunas deste Funil
    const { data: cols } = await supabase
        .from('colunas_funil')
        .select('id, nome, ordem, tipo_coluna, funil_id')
        .eq('funil_id', funilId)
        .eq('organizacao_id', organizacaoId)
        .order('ordem', { ascending: true });
    const todasColunas = cols || [];

    // 2. Busca os Contatos (Leads) — filtrando pelas colunas DESTE funil
    const colIds = todasColunas.map(c => c.id);
    if (colIds.length === 0) return { colunasDoFunil: [], contatosNoFunil: [] };

    let query = supabase.from('contatos_no_funil').select(`
        id, coluna_id, numero_card, corretor_id, created_at,
        contatos:contato_id!inner(*, 
            telefones(telefone, tipo), 
            emails(email, tipo),
            campanha:meta_ativos!fk_meta_campaign(nome, empreendimento_id),
            adset:meta_ativos!fk_meta_adset(nome, empreendimento_id),
            anuncio:meta_ativos!fk_meta_ad(nome, empreendimento_id)
        ),
        corretores:corretor_id(id, nome, razao_social),
        produtos_interesse:contatos_no_funil_produtos(id, produto:produtos_empreendimento(id, unidade, tipo, valor_venda_calculado, empreendimento_id))
    `).eq('organizacao_id', organizacaoId).in('coluna_id', colIds);

    // Filtros Avançados
    if (filters.searchTerm) {
        query = query.or(`nome.ilike.%${filters.searchTerm}%,razao_social.ilike.%${filters.searchTerm}%`, { foreignTable: 'contatos' });
    }
    if (filters.corretorIds?.length > 0) query = query.in('corretor_id', filters.corretorIds);
    if (filters.origens?.length > 0) query = query.in('contatos.origem', filters.origens);
    if (filters.campaignIds?.length > 0) query = query.in('contatos.meta_campaign_id', filters.campaignIds);
    if (filters.adIds?.length > 0) query = query.in('contatos.meta_ad_id', filters.adIds);
    if (filters.startDate) query = query.gte('created_at', filters.startDate + 'T00:00:00');
    if (filters.endDate) query = query.lte('created_at', filters.endDate + 'T23:59:59');

    if (filters.unidadeIds?.length > 0) {
        const { data: funilProductLinks, error: linkError } = await supabase
            .from('contatos_no_funil_produtos').select('contato_no_funil_id').in('produto_id', filters.unidadeIds);
        if (linkError) throw linkError;
        const matchingFunilIds = (funilProductLinks || []).map(link => link.contato_no_funil_id);
        if (matchingFunilIds.length === 0) return { colunasDoFunil: todasColunas, contatosNoFunil: [] };
        query = query.in('id', matchingFunilIds);
    }

    const { data: contatosNoFunilRaw, error: contatosError } = await query;
    if (contatosError) throw contatosError;

    return { colunasDoFunil: todasColunas, contatosNoFunil: (contatosNoFunilRaw || []).filter(item => item.contatos?.id) };
};

// --- LISTA TODOS OS FUNIS DA ORGANIZAÇÃO (o is_sistema aparece primeiro) ---
const fetchAllFunils = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data } = await supabase
        .from('funis')
        .select('id, nome, is_sistema')
        .eq('organizacao_id', organizacaoId)
        .order('is_sistema', { ascending: false }) // Sistema primeiro
        .order('id', { ascending: true });
    return data || [];
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
    const campaigns = [...new Map((contatosParaFiltro || []).filter(c => c.meta_campaign_id && c.meta_campaign_name).map(c => [c.meta_campaign_id, { id: c.meta_campaign_id, nome: c.meta_campaign_name }])).values()].sort((a, b) => a.nome.localeCompare(b.nome));
    const ads = [...new Map((contatosParaFiltro || []).filter(c => c.meta_ad_id && c.meta_ad_name).map(c => [c.meta_ad_id, { id: c.meta_ad_id, nome: c.meta_ad_name }])).values()].sort((a, b) => a.nome.localeCompare(b.nome));

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
    const supabase = createClient();
    const queryClient = useQueryClient();

    const cachedState = getCachedUiState();
    const defaultFilters = { searchTerm: '', corretorIds: [], origens: [], unidadeIds: [], campaignIds: [], adIds: [], startDate: '', endDate: '' };

    const [filters, setFilters] = useState(cachedState?.filters || defaultFilters);
    const [sorting, setSorting] = useState(cachedState?.sorting || {});
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

    const [isWhatsModalOpen, setIsWhatsModalOpen] = useState(false);
    const [contactForWhats, setContactForWhats] = useState(null);
    const [isMetaMappingOpen, setIsMetaMappingOpen] = useState(false);

    // --- SELEÇÃO DE FUNIL ---
    const [selectedFunilId, setSelectedFunilId] = useState(null);
    const [isNovoFunilOpen, setIsNovoFunilOpen] = useState(false);
    const [novoFunilNome, setNovoFunilNome] = useState('');
    const [isFunilDropdownOpen, setIsFunilDropdownOpen] = useState(false);

    useEffect(() => { if (setPageTitle) setPageTitle("CRM - Funil de Vendas"); }, [setPageTitle]);

    // --- QUERY: Lista todos os funis da organização ---
    const { data: todosFunis = [] } = useQuery({
        queryKey: ['allFunis', organizacaoId],
        queryFn: () => fetchAllFunils(supabase, organizacaoId),
        enabled: !!organizacaoId,
        staleTime: 1000 * 60 * 5,
    });

    // Auto-seleciona o primeiro funil quando a lista carrega
    useEffect(() => {
        if (todosFunis.length > 0 && !selectedFunilId) {
            setSelectedFunilId(todosFunis[0].id);
        }
    }, [todosFunis, selectedFunilId]);

    const selectedFunilInfo = todosFunis.find(f => f.id === selectedFunilId);

    const { data: funilData, isLoading: loadingFunil, error: funilError } = useQuery({
        queryKey: ['funilData', organizacaoId, selectedFunilId, debouncedFilters],
        queryFn: () => fetchFunilData(supabase, organizacaoId, selectedFunilId, debouncedFilters),
        enabled: !!organizacaoId && !!selectedFunilId,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        refetchOnWindowFocus: true,
    });

    const { colunasDoFunil = [], contatosNoFunil = [] } = funilData || {};
    const funilId = selectedFunilId; // Alias para compatibilidade com mutations existentes

    const { data: filterOptions } = useQuery({ queryKey: ['crmFilterOptions', organizacaoId], queryFn: () => fetchFilterData(supabase, organizacaoId), enabled: !!organizacaoId, staleTime: 1000 * 60 * 15 });
    const { data: availableProducts = [] } = useQuery({ queryKey: ['availableProducts', organizacaoId], queryFn: () => fetchAvailableProducts(supabase, organizacaoId), enabled: !!organizacaoId });
    const { data: activityData } = useQuery({ queryKey: ['activityModalData', organizacaoId], queryFn: () => fetchActivityModalData(supabase, organizacaoId), enabled: !!organizacaoId });
    const { funcionarios = [], empresas = [] } = activityData || {};

    if (funilError) { toast.error(`Erro ao carregar dados do funil: ${funilError.message}`); }

    const kpiData = useMemo(() => {
        const dataToAnalyze = contatosNoFunil;
        if (!colunasDoFunil || dataToAnalyze.length === 0) return { totalLeads: 0, vendidos: 0, taxaConversao: 0, valorEmNegociacao: 0, ultimoLead: 'N/A' };

        // Usa tipo_coluna para identificar a coluna de conversão de forma robusta
        // (funciona mesmo se o usuário renomear a coluna de 'VENDIDO' para outro nome)
        const colunaVendido = colunasDoFunil.find(c => c.tipo_coluna === 'ganho');

        const totalLeads = dataToAnalyze.length;
        const vendidos = dataToAnalyze.filter(c => c.coluna_id === colunaVendido?.id).length;
        const taxaConversao = totalLeads > 0 ? (vendidos / totalLeads) * 100 : 0;
        const valorEmNegociacao = dataToAnalyze.filter(contato => { const colunaDoContato = colunasDoFunil.find(c => c.id === contato.coluna_id); return colunaDoContato && colunaVendido && colunaDoContato.ordem < (colunaVendido.ordem || -1); }).reduce((acc, contato) => { const valorProdutos = (contato.produtos_interesse || []).reduce((sum, item) => sum + (item.produto?.valor_venda_calculado || 0), 0); return acc + valorProdutos; }, 0);
        const ultimoLeadDate = dataToAnalyze.length > 0 ? new Date(Math.max(...dataToAnalyze.map(c => new Date(c.created_at)))) : null;

        return { totalLeads, vendidos, taxaConversao, valorEmNegociacao, ultimoLead: ultimoLeadDate ? formatRelativeDate(ultimoLeadDate) : 'N/A' };
    }, [contatosNoFunil, colunasDoFunil]);

    const mutationOptions = { onSuccess: (message) => { toast.success(message || "Operação realizada com sucesso!"); queryClient.invalidateQueries({ queryKey: ['funilData', organizacaoId, selectedFunilId, debouncedFilters] }); queryClient.invalidateQueries({ queryKey: ['availableProducts', organizacaoId] }); queryClient.invalidateQueries({ queryKey: ['crmFilterOptions', organizacaoId] }); }, onError: (error) => toast.error(error.message) };

    // --- CRIAÇÃO DE NOVO FUNIL (com colunas-âncora automáticas) ---
    const createFunilMutation = useMutation({
        mutationFn: async (nome) => {
            if (!nome.trim()) throw new Error('O nome do funil é obrigatório.');
            // 1. Cria o funil
            const { data: novoFunil, error: funilErr } = await supabase
                .from('funis').insert({ nome: nome.trim(), organizacao_id: organizacaoId }).select('id').single();
            if (funilErr) throw funilErr;
            // 2. Cria as 3 colunas-âncora obrigatórias
            const colunas = [
                { nome: 'ENTRADA', tipo_coluna: 'entrada', ordem: 0, funil_id: novoFunil.id, organizacao_id: organizacaoId },
                { nome: 'VENDIDO', tipo_coluna: 'ganho', ordem: 98, funil_id: novoFunil.id, organizacao_id: organizacaoId },
                { nome: 'PERDIDO', tipo_coluna: 'perdido', ordem: 99, funil_id: novoFunil.id, organizacao_id: organizacaoId },
            ];
            await supabase.from('colunas_funil').insert(colunas).throwOnError();
            return novoFunil.id;
        },
        onSuccess: (novoId) => {
            toast.success('Funil criado com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['allFunis', organizacaoId] });
            setSelectedFunilId(novoId);
            setNovoFunilNome('');
            setIsNovoFunilOpen(false);
        },
        onError: (err) => toast.error(err.message),
    });

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
            return "Card movido com sucesso!";
        },
        onSuccess: (message) => { toast.success(message); queryClient.invalidateQueries({ queryKey: ['funilData', organizacaoId, debouncedFilters] }); },
        onError: (error) => { toast.error(`Erro ao mover o card: ${error.message}`); }
    });

    // --- ADIÇÃO MANUAL DE CONTATO: Usa Coluna ENTRADA do Funil de Entrada (is_sistema=true) ---
    const addContactMutation = useMutation({
        mutationFn: async (contactId) => {
            // Busca o funil do sistema primeiro
            const { data: funilSistema } = await supabase
                .from('funis').select('id')
                .eq('organizacao_id', organizacaoId)
                .eq('is_sistema', true)
                .maybeSingle();

            if (!funilSistema) throw new Error("Funil de Entrada do sistema não encontrado.");

            const { data: colunaEntrada } = await supabase
                .from('colunas_funil').select('id')
                .eq('funil_id', funilSistema.id)
                .eq('tipo_coluna', 'entrada')
                .maybeSingle();

            if (!colunaEntrada) throw new Error("Coluna 'ENTRADA' não encontrada no Funil de Entrada.");

            await supabase.from('contatos_no_funil').insert({
                contato_id: contactId,
                coluna_id: colunaEntrada.id,
                organizacao_id: organizacaoId
            }).throwOnError();
            return "Contato adicionado!";
        },
        onSuccess: (message) => { setIsAddContactModalOpen(false); mutationOptions.onSuccess(message); },
        onError: mutationOptions.onError
    });

    const createColumnMutation = useMutation({ mutationFn: async (name) => { await supabase.from('colunas_funil').insert({ nome: name, funil_id: funilId, ordem: colunasDoFunil.length, organizacao_id: organizacaoId }).throwOnError(); return "Etapa criada!"; }, ...mutationOptions });
    const reorderColumnsMutation = useMutation({ mutationFn: async (cols) => { const updates = cols.map(c => supabase.from('colunas_funil').update({ ordem: c.ordem }).eq('id', c.id)); await Promise.all(updates); return "Ordem salva!"; }, ...mutationOptions });
    const deleteColumnCardsMutation = useMutation({ mutationFn: async (colId) => { await supabase.from('contatos_no_funil').delete().eq('coluna_id', colId).throwOnError(); return "Cards excluídos!"; }, ...mutationOptions });
    const deleteCardMutation = useMutation({ mutationFn: async (cardId) => { await supabase.from('contatos_no_funil').delete().eq('id', cardId).throwOnError(); return "Card excluído!"; }, ...mutationOptions });
    const dissociateProductMutation = useMutation({ mutationFn: async (id) => { await supabase.from('contatos_no_funil_produtos').delete().eq('id', id).throwOnError(); return "Produto removido!"; }, ...mutationOptions });
    const associateCorretorMutation = useMutation({ mutationFn: async ({ contactId, corretorId }) => { await supabase.from('contatos_no_funil').update({ corretor_id: corretorId }).eq('id', contactId).throwOnError(); return "Corretor associado!"; }, ...mutationOptions });
    const editColumnMutation = useMutation({ mutationFn: async ({ columnId, newName }) => { const { error } = await supabase.from('colunas_funil').update({ nome: newName }).eq('id', columnId).eq('organizacao_id', organizacaoId); if (error) throw error; return "Nome da etapa atualizado!"; }, ...mutationOptions });

    // --- EXCLUSÃO DE COLUNA: Move cards para ENTRADA nativa da Org por segurança ---
    const deleteColumnMutation = useMutation({
        mutationFn: async (columnIdToDelete) => {
            // Busca coluna de destino (ENTRADA nativa desta organização)
            const { data: firstColumn } = await supabase
                .from('colunas_funil')
                .select('id')
                .eq('organizacao_id', organizacaoId)
                .eq('tipo_coluna', 'entrada')
                .maybeSingle();
            if (!firstColumn) throw new Error('Coluna de destino (ENTRADA) não encontrada.');

            if (columnIdToDelete === firstColumn.id) throw new Error('Não é possível excluir a coluna mestre ENTRADA.');

            // Move contatos
            const { error: moveError } = await supabase.from('contatos_no_funil').update({ coluna_id: firstColumn.id }).eq('coluna_id', columnIdToDelete);
            if (moveError) throw new Error(`Erro ao mover os contatos: ${moveError.message}`);

            // Deleta coluna
            const { error: deleteError } = await supabase.from('colunas_funil').delete().eq('id', columnIdToDelete);
            if (deleteError) throw new Error(`Erro ao excluir a coluna: ${deleteError.message}`);

            return "Etapa excluída! Contatos movidos para ENTRADA.";
        }, ...mutationOptions
    });

    const [debounceSearchTimeout, setDebounceSearchTimeout] = useState(null);
    const handleSearch = (term) => { clearTimeout(debounceSearchTimeout); if (!term.trim() || term.length < 2) { setSearchResults([]); return; } setDebounceSearchTimeout(setTimeout(async () => { const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: term, p_organizacao_id: organizacaoId }); setSearchResults(data || []); }, 300)); };
    const openAddContactModal = () => { setSearchResults([]); setIsAddContactModalOpen(true); };
    const handleStatusChange = (contactId, columnId) => handleStatusChangeMutation.mutate({ contatoNoFunilId: contactId, newColumnId: columnId });

    const handleStartWhatsApp = (entry) => {
        const contact = entry.contatos;
        if (!contact) return;
        const phone = contact.telefones?.[0]?.telefone || contact.telefones?.[0] || contact.telefone;
        if (!phone) { toast.error("Este contato não possui telefone cadastrado."); return; }
        setContactForWhats({ id: contact.id, nome: contact.nome || contact.razao_social || 'Cliente', telefones: [{ telefone: phone }] });
        setIsWhatsModalOpen(true);
    };

    return (
        <div className="h-full flex flex-col bg-gray-100">
            <CrmDetalhesSidebar open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} funilEntry={selectedContactForSidebar} onAddActivity={(c) => { setContactForNewActivity(c); setIsActivityModalOpen(true); }} onEditActivity={(a) => { setActivityToEdit(a); setIsActivityModalOpen(true); }} onContactUpdate={() => queryClient.invalidateQueries({ queryKey: ['funilData', organizacaoId, selectedFunilId, debouncedFilters] })} refreshKey={sidebarRefreshKey} />
            {isActivityModalOpen && (<AtividadeModal isOpen={isActivityModalOpen} onClose={() => { setIsActivityModalOpen(false); setContactForNewActivity(null); setActivityToEdit(null); }} onActivityAdded={() => { if (isSidebarOpen) setSidebarRefreshKey(p => p + 1); }} activityToEdit={activityToEdit} initialContatoId={contactForNewActivity?.id} funcionarios={funcionarios} allEmpresas={empresas} />)}

            <div className="flex-shrink-0 bg-white shadow-sm p-6 space-y-6">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    {/* --- SELETOR DE FUNIL --- */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button
                                onClick={() => setIsFunilDropdownOpen(o => !o)}
                                className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group"
                            >
                                <FontAwesomeIcon icon={faLayerGroup} className="text-blue-500" />
                                <span className="text-xl font-bold text-gray-800 leading-tight">
                                    {selectedFunilInfo?.nome || 'Carregando...'}
                                </span>
                                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isFunilDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {isFunilDropdownOpen && (
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
                                    <div className="p-2 space-y-0.5">
                                        {todosFunis.map(funil => (
                                            <div
                                                key={funil.id}
                                                className={`w-full flex items-center gap-1 rounded-lg transition-colors ${funil.id === selectedFunilId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                            >
                                                <button
                                                    onClick={() => { setSelectedFunilId(funil.id); setIsFunilDropdownOpen(false); }}
                                                    className={`flex-1 text-left px-3 py-2.5 text-sm font-medium flex items-center gap-2 ${funil.id === selectedFunilId ? 'text-blue-700' : 'text-gray-700'}`}
                                                >
                                                    <FontAwesomeIcon icon={faLayerGroup} className={funil.id === selectedFunilId ? 'text-blue-500' : 'text-gray-400'} />
                                                    {funil.nome}
                                                    {funil.is_sistema && (
                                                        <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                            🔒 Sistema
                                                        </span>
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-gray-100 p-2">
                                        <button
                                            onClick={() => { setIsFunilDropdownOpen(false); setIsNovoFunilOpen(true); }}
                                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2"
                                        >
                                            <FontAwesomeIcon icon={faPlus} />
                                            Novo Funil
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            {kpiData.totalLeads} leads
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                        <div className="relative flex-grow xl:flex-grow-0 min-w-[200px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FontAwesomeIcon icon={faSearch} className="text-gray-400 text-sm" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar no funil..."
                                value={filters.searchTerm}
                                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`border text-sm font-bold py-2 px-4 rounded-md shadow-sm flex items-center gap-2 transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                            title="Filtros Avançados"
                        >
                            <FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500" : "text-gray-400"} /> Filtros
                        </button>
                        <button
                            onClick={() => setIsMetaMappingOpen(true)}
                            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-bold py-2 px-4 rounded-md shadow-sm flex items-center gap-2 transition-colors"
                            title="Mapear Campos do Formulário Meta"
                        >
                            <FontAwesomeIcon icon={faTable} className="text-blue-600" /> Mapear Meta
                        </button>
                        <Link href="/crm/automacao" className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-bold py-2 px-4 rounded-md shadow-sm flex items-center gap-2 transition-colors">
                            <FontAwesomeIcon icon={faRobot} className="text-purple-500" /> Automações
                        </Link>
                        <button
                            onClick={openAddContactModal}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-4 rounded-md shadow-sm flex items-center gap-2 transition-colors"
                        >
                            <FontAwesomeIcon icon={faPlus} /> Novo Lead
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <FiltroCrm filters={filters} setFilters={setFilters} corretores={filterOptions?.corretores} unidades={filterOptions?.unidades} origens={filterOptions?.origens} campaigns={filterOptions?.campaigns} ads={filterOptions?.ads} />
                )}

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
            <NewConversationModal isOpen={isWhatsModalOpen} onClose={() => setIsWhatsModalOpen(false)} preSelectedContact={contactForWhats} />
            <MetaFormMappingModal isOpen={isMetaMappingOpen} onClose={() => setIsMetaMappingOpen(false)} organizacaoId={organizacaoId} />

            {/* Backdrop para fechar o dropdown de funis */}
            {isFunilDropdownOpen && (
                <div className="fixed inset-0 z-20" onClick={() => setIsFunilDropdownOpen(false)} />
            )}

            {/* Modal: Criar Novo Funil */}
            {isNovoFunilOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={faLayerGroup} className="text-blue-500" />
                                Novo Funil
                            </h2>
                            <button onClick={() => setIsNovoFunilOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <p className="text-sm text-gray-500">
                            O novo funil já virá com as colunas <strong>ENTRADA</strong>, <strong>VENDIDO</strong> e <strong>PERDIDO</strong> criadas automaticamente.
                        </p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Funil</label>
                            <input
                                type="text"
                                placeholder="Ex: Residencial Alfa, Studios Beta..."
                                value={novoFunilNome}
                                onChange={(e) => setNovoFunilNome(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && novoFunilNome.trim()) createFunilMutation.mutate(novoFunilNome); }}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setIsNovoFunilOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => createFunilMutation.mutate(novoFunilNome)}
                                disabled={!novoFunilNome.trim() || createFunilMutation.isPending}
                                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {createFunilMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} />}
                                Criar Funil
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
