'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faFilter, faCheck, faSpinner, faUsers, faSave, faSearch, faTrash, faLayerGroup, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

export default function CreateBroadcastModal({ isOpen, onClose, onListCreated, initialData = null }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    
    // Filtros - ADICIONADO "Corretor" AQUI
    const [funnels, setFunnels] = useState([]);
    const [columns, setColumns] = useState([]);
    const [types, setTypes] = useState(['Lead', 'Cliente', 'Fornecedor', 'Parceiro', 'Corretor']); 
    
    const [filters, setFilters] = useState({
        nameSearch: '',
        contactType: '',
        funnelId: '',
        columnId: ''
    });

    const [debouncedSearch] = useDebounce(filters.nameSearch, 500);

    // Resultados
    const [foundContacts, setFoundContacts] = useState([]); 
    const [selectedContacts, setSelectedContacts] = useState([]); 
    const [selectedContactDetails, setSelectedContactDetails] = useState([]); 
    
    const [listName, setListName] = useState('');
    const [listDescription, setListDescription] = useState('');
    const [isDynamic, setIsDynamic] = useState(true);
    const [viewMode, setViewMode] = useState('search'); 

    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // 1. Carregar Dados Iniciais (Edição ou Criação)
    useEffect(() => {
        if (isOpen && organizacaoId) {
            // Carrega Funis
            const fetchFunnels = async () => {
                const { data } = await supabase.from('funis').select('id, nome').eq('organizacao_id', organizacaoId);
                setFunnels(data || []);
            };
            fetchFunnels();

            // MODO EDIÇÃO: Preencher dados
            if (initialData) {
                setListName(initialData.nome || '');
                setListDescription(initialData.descricao || '');
                setIsDynamic(initialData.is_dynamic || false);
                
                if (initialData.filtros_usados) {
                    setFilters(initialData.filtros_usados);
                }

                // Carregar membros existentes
                const fetchMembers = async () => {
                    const { data } = await supabase
                        .from('whatsapp_list_members')
                        .select('contatos(id, nome, telefones(telefone), tipo_contato)')
                        .eq('lista_id', initialData.id);

                    if (data) {
                        const formatted = data.map(m => ({
                            id: m.contatos?.id,
                            nome: m.contatos?.nome,
                            telefone: m.contatos?.telefones?.[0]?.telefone,
                            tipo: m.contatos?.tipo_contato
                        })).filter(c => c.id && c.telefone);

                        setSelectedContacts(formatted.map(c => c.id));
                        setSelectedContactDetails(formatted);
                    }
                };
                fetchMembers();

            } else {
                // MODO CRIAÇÃO: Reset Total
                setFilters({ nameSearch: '', contactType: '', funnelId: '', columnId: '' });
                setFoundContacts([]);
                setSelectedContacts([]);
                setSelectedContactDetails([]);
                setListName('');
                setListDescription('');
                setIsDynamic(true);
            }
            
            setStep(1);
            setViewMode('search');
        }
    }, [isOpen, organizacaoId, initialData, supabase]);

    // 2. Carregar Colunas se tiver funil selecionado
    useEffect(() => {
        if (filters.funnelId) {
            const fetchColumns = async () => {
                const { data } = await supabase.from('colunas_funil').select('id, nome').eq('funil_id', filters.funnelId).order('ordem');
                setColumns(data || []);
            };
            fetchColumns();
        } else {
            setColumns([]);
        }
    }, [filters.funnelId, supabase]);

    // 3. Busca Inteligente
    const handleSearch = useCallback(async (isAuto = false) => {
        if (!organizacaoId) return;

        setLoading(true);
        try {
            let query = supabase
                .from('contatos')
                .select(`
                    id, nome, tipo_contato, 
                    telefones!inner(telefone),
                    contatos_no_funil!contatos_no_funil_contato_id_fkey (
                        coluna_id,
                        colunas_funil (nome)
                    )
                `)
                .eq('organizacao_id', organizacaoId)
                .limit(2000); 

            if (filters.nameSearch) query = query.ilike('nome', `%${filters.nameSearch}%`);
            if (filters.contactType) query = query.eq('tipo_contato', filters.contactType);

            const { data, error } = await query;
            if (error) throw error;

            let filtered = data || [];

            if (filters.funnelId || filters.columnId) {
                const validColumnIds = columns.map(c => c.id);
                filtered = filtered.filter(contact => {
                    const entries = Array.isArray(contact.contatos_no_funil) ? contact.contatos_no_funil : (contact.contatos_no_funil ? [contact.contatos_no_funil] : []);
                    if (entries.length === 0) return false;
                    if (filters.columnId) return entries.some(e => e.coluna_id === filters.columnId);
                    if (filters.funnelId) return entries.some(e => validColumnIds.includes(e.coluna_id));
                    return true;
                });
            }

            const validContacts = filtered.map(c => {
                const funilInfo = Array.isArray(c.contatos_no_funil) ? c.contatos_no_funil[0] : c.contatos_no_funil;
                return {
                    id: c.id,
                    nome: c.nome,
                    telefone: c.telefones[0].telefone,
                    tipo: c.tipo_contato,
                    etapa: funilInfo?.colunas_funil?.nome || null
                };
            });

            setFoundContacts(validContacts);
            
        } catch (error) {
            console.error(error);
            if(!isAuto) toast.error("Erro na busca.");
        } finally {
            setLoading(false);
        }
    }, [organizacaoId, filters, columns, supabase]);

    useEffect(() => {
        handleSearch(true);
    }, [debouncedSearch, filters.contactType, filters.columnId, filters.funnelId, handleSearch]);

    const toggleContact = (contact) => {
        const isSelected = selectedContacts.includes(contact.id);
        if (isSelected) {
            setSelectedContacts(prev => prev.filter(id => id !== contact.id));
            setSelectedContactDetails(prev => prev.filter(c => c.id !== contact.id));
        } else {
            setSelectedContacts(prev => [...prev, contact.id]);
            setSelectedContactDetails(prev => [...prev, contact]);
        }
    };

    const toggleSelectAllVisible = () => {
        const newIds = [];
        const newDetails = [];
        foundContacts.forEach(c => {
            if (!selectedContacts.includes(c.id)) {
                newIds.push(c.id);
                newDetails.push(c);
            }
        });
        if (newIds.length > 0) {
            setSelectedContacts(prev => [...prev, ...newIds]);
            setSelectedContactDetails(prev => [...prev, ...newDetails]);
            toast.success(`${newIds.length} adicionados!`);
        }
    };

    const handleSaveList = async () => {
        if (!listName.trim()) return toast.warning("Dê um nome para a lista.");
        if (selectedContacts.length === 0) return toast.warning("Selecione contatos.");

        setLoading(true);
        try {
            let listId = initialData?.id;

            // 1. Criar ou Atualizar Lista
            if (initialData) {
                // UPDATE
                const { error: updateError } = await supabase
                    .from('whatsapp_broadcast_lists')
                    .update({
                        nome: listName,
                        descricao: listDescription,
                        filtros_usados: filters,
                        is_dynamic: isDynamic
                    })
                    .eq('id', listId);
                
                if (updateError) throw updateError;
                
                // Limpa membros antigos para regravar
                await supabase.from('whatsapp_list_members').delete().eq('lista_id', listId);

            } else {
                // INSERT
                const { data: newList, error: insertError } = await supabase
                    .from('whatsapp_broadcast_lists')
                    .insert({
                        nome: listName,
                        descricao: listDescription,
                        filtros_usados: filters,
                        is_dynamic: isDynamic,
                        organizacao_id: organizacaoId,
                        criado_por: user.id
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                listId = newList.id;
            }

            // 2. Gravar Membros
            const membersPayload = selectedContacts.map(id => ({
                lista_id: listId,
                contato_id: id
            }));

            const { error: memError } = await supabase.from('whatsapp_list_members').insert(membersPayload);
            if (memError) throw memError;

            toast.success(initialData ? "Lista atualizada!" : "Lista criada!");
            if (onListCreated) onListCreated();
            onClose();

        } catch (error) {
            toast.error("Erro ao salvar: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                
                <div className="flex justify-between items-center p-5 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            {initialData ? 'Editar Lista' : 'Criar Lista de Transmissão'}
                        </h2>
                        <p className="text-sm text-gray-500">Passo {step}: {step === 1 ? 'Filtrar Contatos' : 'Revisar e Salvar'}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div className="flex items-center gap-2 mb-2 text-gray-600 font-semibold text-sm">
                                    <FontAwesomeIcon icon={faFilter} /> Filtros de Busca
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="relative">
                                        <input type="text" className="w-full border rounded-lg p-2.5 pl-9 text-sm focus:ring-[#00a884] outline-none" placeholder="Buscar por nome..." value={filters.nameSearch} onChange={(e) => setFilters({...filters, nameSearch: e.target.value})} autoFocus />
                                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400 text-sm" />
                                    </div>
                                    <select className="w-full border rounded-lg p-2.5 text-sm focus:ring-[#00a884] bg-white" value={filters.contactType} onChange={(e) => setFilters({...filters, contactType: e.target.value})}>
                                        <option value="">Todos os Tipos</option>
                                        {types.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <select className="w-full border rounded-lg p-2.5 text-sm focus:ring-[#00a884] bg-white" value={filters.funnelId} onChange={(e) => setFilters({...filters, funnelId: e.target.value, columnId: ''})}>
                                        <option value="">Todos os Funis</option>
                                        {funnels.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                    </select>
                                    <select className="w-full border rounded-lg p-2.5 text-sm focus:ring-[#00a884] bg-white disabled:bg-gray-100" value={filters.columnId} onChange={(e) => setFilters({...filters, columnId: e.target.value})} disabled={!filters.funnelId}>
                                        <option value="">Todas as Etapas</option>
                                        {columns.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-4 border-b mt-2">
                                <button onClick={() => setViewMode('search')} className={`pb-2 text-sm font-medium transition-colors ${viewMode === 'search' ? 'border-b-2 border-[#00a884] text-[#00a884]' : 'text-gray-500 hover:text-gray-700'}`}>Resultados ({foundContacts.length})</button>
                                <button onClick={() => setViewMode('selected')} className={`pb-2 text-sm font-medium transition-colors ${viewMode === 'selected' ? 'border-b-2 border-[#00a884] text-[#00a884]' : 'text-gray-500 hover:text-gray-700'}`}>Selecionados ({selectedContacts.length})</button>
                            </div>

                            <div className="border rounded-lg h-60 overflow-y-auto bg-white p-1 custom-scrollbar">
                                {loading ? <div className="flex justify-center items-center h-full text-gray-400 gap-2"><FontAwesomeIcon icon={faSpinner} spin /> Buscando...</div> : 
                                viewMode === 'search' ? (
                                    foundContacts.length > 0 ? (
                                        <div className="space-y-1">
                                            <div className="flex justify-end px-2 py-1 sticky top-0 bg-white z-10 border-b mb-1"><button onClick={toggleSelectAllVisible} className="text-xs text-[#00a884] hover:underline font-bold uppercase tracking-wide">+ Selecionar Todos</button></div>
                                            {foundContacts.map(contact => (
                                                <div key={contact.id} onClick={() => toggleContact(contact)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors mb-1 ${selectedContacts.includes(contact.id) ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${selectedContacts.includes(contact.id) ? 'bg-[#00a884] border-[#00a884]' : 'border-gray-300 bg-white'}`}>{selectedContacts.includes(contact.id) && <FontAwesomeIcon icon={faCheck} className="text-white text-xs" />}</div>
                                                    <div className="flex-grow min-w-0">
                                                        <div className="flex justify-between items-center">
                                                            <p className="font-medium text-gray-800 text-sm truncate">{contact.nome}</p>
                                                            {contact.etapa && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ml-2"><FontAwesomeIcon icon={faLayerGroup} /> {contact.etapa}</span>}
                                                        </div>
                                                        <p className="text-xs text-gray-500">{contact.telefone} • {contact.tipo || 'Sem tipo'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm"><FontAwesomeIcon icon={faSearch} size="2x" className="mb-2 opacity-20" /><p>Nenhum contato encontrado.</p></div>
                                ) : (
                                    selectedContactDetails.length > 0 ? (
                                        <div className="space-y-1">
                                            {selectedContactDetails.map(contact => (
                                                <div key={contact.id} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs shrink-0"><FontAwesomeIcon icon={faUsers} /></div>
                                                        <div className="min-w-0"><p className="font-medium text-gray-800 text-sm truncate">{contact.nome}</p><p className="text-xs text-gray-500">{contact.telefone}</p></div>
                                                    </div>
                                                    <button onClick={() => toggleContact(contact)} className="text-red-400 hover:text-red-600 p-2 shrink-0"><FontAwesomeIcon icon={faTrash} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm"><p>Nenhum contato selecionado ainda.</p></div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faCheck} className="text-blue-600" />Tudo pronto!</h3>
                                <p className="text-sm text-gray-600 mt-1">Sua lista tem <strong>{selectedContacts.length}</strong> contatos.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Lista *</label>
                                <input type="text" className="w-full border rounded-lg p-3 focus:ring-[#00a884] outline-none" placeholder="Ex: Clientes Quentes Dezembro" value={listName} onChange={(e) => setListName(e.target.value)} autoFocus />
                            </div>

                            <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border">
                                <input type="checkbox" id="dynamic-check" checked={isDynamic} onChange={(e) => setIsDynamic(e.target.checked)} className="mt-1 w-5 h-5 text-[#00a884] rounded focus:ring-[#00a884]" />
                                <label htmlFor="dynamic-check" className="cursor-pointer">
                                    <span className="block font-semibold text-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faSyncAlt} className="text-[#00a884]" /> Lista Dinâmica (Recomendado)</span>
                                    <span className="block text-xs text-gray-500 mt-1">Se um contato mudar de etapa ou tipo no futuro, a lista se atualizará automaticamente quando você clicar em "Sincronizar" no painel.</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                <textarea className="w-full border rounded-lg p-3 focus:ring-[#00a884] outline-none" rows={3} value={listDescription} onChange={(e) => setListDescription(e.target.value)} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
                    {step === 2 ? <button onClick={() => setStep(1)} className="text-gray-600 hover:underline text-sm">Voltar</button> : <div className="text-sm text-gray-500">{selectedContacts.length} selecionados</div>}
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm">Cancelar</button>
                        {step === 1 ? (
                            <button onClick={() => setStep(2)} disabled={selectedContacts.length === 0} className="bg-[#00a884] text-white px-6 py-2 rounded-lg hover:bg-[#008f6f] disabled:opacity-50 text-sm font-medium">Continuar</button>
                        ) : (
                            <button onClick={handleSaveList} disabled={loading || !listName.trim()} className="bg-[#00a884] text-white px-6 py-2 rounded-lg hover:bg-[#008f6f] flex items-center gap-2 disabled:opacity-50 text-sm font-medium">
                                {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                                {initialData ? 'Atualizar Lista' : 'Salvar Lista'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}