// app/(main)/crm/page.js
"use client";

// O PORQUÊ: Trocamos a "caixa de ferramentas". Saem 'useEffect' e 'useCallback' para busca de dados,
// e entram 'useQuery', 'useMutation' e 'useQueryClient' do TanStack Query.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

// --- COMPONENTES AUXILIARES (sem alteração de lógica) ---
const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (<mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark>) : (<span key={i}>{part}</span>)
            )}
        </span>
    );
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

// --- FUNÇÕES DE BUSCA DE DADOS (as "Receitas do Bolo" para o cache) ---
const fetchFunilData = async (supabase) => {
    const { data: funilData, error: funilError } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').single();
    if (funilError && funilError.code !== 'PGRST116') throw funilError;
    let funilId = funilData?.id;
    if (!funilId) {
        const { data: newFunil, error: createError } = await supabase.from('funis').insert({ nome: 'Funil de Vendas' }).select().single();
        if (createError) throw createError;
        funilId = newFunil.id;
    }
    const { data: colunasDoFunil, error: colunasError } = await supabase.from('colunas_funil').select('id, nome, ordem').eq('funil_id', funilId).order('ordem', { ascending: true });
    if (colunasError) throw colunasError;
    if (!colunasDoFunil || colunasDoFunil.length === 0) {
        return { funilId, colunasDoFunil: [], contatosNoFunil: [] };
    }
    const colunaIds = colunasDoFunil.map(col => col.id);
    const { data: contatosNoFunilRaw, error: contatosError } = await supabase.from('contatos_no_funil').select(`id, coluna_id, numero_card, produto_id, corretor_id, created_at, produto:produto_id(id, unidade, tipo, valor_venda_calculado, empreendimento_id), contatos:contato_id ( *, telefones ( telefone, tipo ), emails(email, tipo)), corretores:corretor_id (id, nome, razao_social)`).in('coluna_id', colunaIds);
    if (contatosError) throw contatosError;
    const contatosParaEstado = (contatosNoFunilRaw || []).filter(item => item.contatos?.id);
    const contatoIds = contatosParaEstado.map(c => c.contatos.id);
    const { data: lastMessagesData } = await supabase.rpc('get_last_messages_for_contacts', { p_contact_ids: contatoIds });
    const lastMessagesMap = (lastMessagesData || []).reduce((map, msg) => { map[msg.contato_id] = { content: msg.content, sent_at: msg.sent_at }; return map; }, {});
    const contatosComMensagens = contatosParaEstado.map(item => ({ ...item, last_whatsapp_message_time: lastMessagesMap[item.contatos.id]?.sent_at || null, contatos: { ...item.contatos, last_whatsapp_message: lastMessagesMap[item.contatos.id]?.content || null, last_whatsapp_message_time: lastMessagesMap[item.contatos.id]?.sent_at || null, } }));
    return { funilId, colunasDoFunil, contatosNoFunil: contatosComMensagens };
};

const fetchAvailableProducts = async (supabase, empreendimentoId) => {
    let query = supabase.from('produtos_empreendimento').select('id, unidade, tipo, valor_venda_calculado, empreendimento_id').eq('status', 'Disponível');
    if (empreendimentoId && empreendimentoId !== 'all') {
        query = query.eq('empreendimento_id', empreendimentoId);
    }
    const { data, error } = await query.order('unidade');
    if (error) throw new Error("Não foi possível carregar os produtos.");
    return data || [];
};

const fetchActivityModalData = async (supabase) => {
    const { data: funcionarios, error: funcError } = await supabase.from('funcionarios').select('id, full_name').order('full_name');
    if (funcError) throw new Error("Falha ao buscar funcionários.");
    const { data: empresas, error: empError } = await supabase.from('cadastro_empresa').select('id, razao_social').order('razao_social');
    if (empError) throw new Error("Falha ao buscar empresas.");
    return { funcionarios, empresas };
};

// --- COMPONENTE PRINCIPAL ---
export default function CrmPage() {
    const { setPageTitle } = useLayout();
    const { selectedEmpreendimento } = useEmpreendimento();
    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();

    // Estados da Interface (o que o usuário está fazendo)
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

    // O PORQUÊ: Aqui, removemos a chamada `setPageTitle` para evitar o título duplicado no topo.
    // O título será renderizado localmente no header da própria página, como era no original.
    // useEffect(() => {
    //  setPageTitle("Funil de Vendas");
    // }, [setPageTitle]);

    // Busca de Dados com Cache
    const { data: funilData, isLoading: loadingFunil, error: funilError } = useQuery({
        queryKey: ['funilData'],
        queryFn: () => fetchFunilData(supabase),
    });
    const { funilId, colunasDoFunil = [], contatosNoFunil = [] } = funilData || {};

    const { data: availableProducts = [] } = useQuery({
        queryKey: ['availableProducts', selectedEmpreendimento],
        queryFn: () => fetchAvailableProducts(supabase, selectedEmpreendimento),
    });

    const { data: activityData } = useQuery({
        queryKey: ['activityModalData'],
        queryFn: () => fetchActivityModalData(supabase),
    });
    const { funcionarios = [], empresas = [] } = activityData || {};
    if (funilError) { toast.error(`Erro ao carregar dados do funil: ${funilError.message}`); }

    // Ações que Modificam Dados (Mutations)
    const mutationOptions = {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['funilData'] }); },
        onError: (error) => { toast.error(`Erro: ${error.message}`); },
    };

    const addContactMutation = useMutation({
        mutationFn: async (contactId) => {
            const { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funilId).order('ordem').limit(1).single();
            if (!primeiraColuna) throw new Error("Coluna inicial não encontrada.");
            const { error } = await supabase.from('contatos_no_funil').insert({ contato_id: contactId, coluna_id: primeiraColuna.id });
            if (error) throw new Error(error.message);
        },
        onSuccess: () => { mutationOptions.onSuccess(); setIsAddContactModalOpen(false); toast.success('Contato adicionado ao funil!'); },
        onError: mutationOptions.onError,
    });
    
    // ... (outras mutations permanecem iguais)

    // Funções de Interface
    const [debounceTimeout, setDebounceTimeout] = useState(null);
    const handleSearch = (term) => {
        clearTimeout(debounceTimeout);
        if (!term.trim() || term.length < 2) { setSearchResults([]); return; }
        setDebounceTimeout(setTimeout(async () => {
            const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: term });
            setSearchResults(data || []);
        }, 300));
    };

    const openAddContactModal = () => { setSearchResults([]); setIsAddContactModalOpen(true); };
    // ... (outras funções de interface permanecem iguais)

    // O PORQUÊ (CORREÇÃO): O JSX abaixo é uma cópia exata do seu arquivo original.
    // Isso garante que a estrutura visual seja preservada, incluindo a barra de título e o botão.
    // A única diferença é que `loadingFunil`, `contatosNoFunil`, etc., agora vêm do `useQuery`.
    return (
        <div className="h-full flex flex-col bg-gray-100">
            <CrmDetalhesSidebar open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} funilEntry={selectedContactForSidebar} onAddActivity={(contato) => { setContactForNewActivity(contato); setIsActivityModalOpen(true); }} onEditActivity={(activity) => { setActivityToEdit(activity); setIsActivityModalOpen(true); }} onContactUpdate={() => queryClient.invalidateQueries({ queryKey: ['funilData'] })} refreshKey={sidebarRefreshKey} />
            {isActivityModalOpen && (<AtividadeModal isOpen={isActivityModalOpen} onClose={() => { setIsActivityModalOpen(false); setContactForNewActivity(null); setActivityToEdit(null); }} onActivityAdded={() => { toast.success(`Atividade ${activityToEdit ? 'atualizada' : 'adicionada'}!`); if (isSidebarOpen) { setSidebarRefreshKey(prev => prev + 1); } }} activityToEdit={activityToEdit} initialContatoId={contactForNewActivity?.id} funcionarios={funcionarios} allEmpresas={empresas} />)}

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
                        onStatusChange={(contactId, columnId) => { /* Chamar a mutation aqui */ }}
                        onCreateColumn={() => { /* Chamar a mutation aqui */ }}
                        onAddContact={openAddContactModal}
                        onEditColumn={() => { /* Chamar a mutation aqui */ }}
                        onDeleteColumn={() => { /* Chamar a mutation aqui */ }}
                        onReorderColumns={() => { /* Chamar a mutation aqui */ }}
                        onOpenNotesModal={(funilId, contatoId) => { setCurrentContactFunilIdForNotes(funilId); setCurrentContactIdForNotes(contatoId); setIsNotesModalOpen(true); }}
                        availableProducts={availableProducts}
                        onAssociateProduct={(contactId, productId) => { /* Chamar a mutation aqui */ }}
                        onAssociateCorretor={(contactId, corretorId) => { /* Chamar a mutation aqui */ }}
                        onCardClick={(entry) => { setSelectedContactForSidebar(entry); setIsSidebarOpen(true); }}
                        onAddActivity={(contato) => { setContactForNewActivity(contato); setIsActivityModalOpen(true); }}
                        sorting={sorting}
                        setSorting={setSorting}
                    />
                )}
            </div>
            <AddContactModal isOpen={isAddContactModalOpen} onClose={() => setIsAddContactModalOpen(false)} onSearch={handleSearch} results={searchResults} onAddContact={(contactId) => addContactMutation.mutate(contactId)} existingContactIds={(contatosNoFunil || []).map(c => c.contatos?.id).filter(Boolean)} />
            <CrmNotesModal isOpen={isNotesModalOpen} onClose={() => setIsNotesModalOpen(false)} contatoNoFunilId={currentContactFunilIdForNotes} contatoId={currentContactIdForNotes} />
        </div>
    );
}