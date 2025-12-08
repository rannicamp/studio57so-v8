'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faFilter, faCheck, faSpinner, faUsers, faSave, faSearch } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function CreateBroadcastModal({ isOpen, onClose, onListCreated }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    
    const [funnels, setFunnels] = useState([]);
    const [columns, setColumns] = useState([]);
    const [types, setTypes] = useState(['Lead', 'Cliente', 'Fornecedor', 'Parceiro']); 
    
    const [filters, setFilters] = useState({
        funnelId: '',
        columnId: '',
        contactType: '',
        nameSearch: ''
    });

    const [foundContacts, setFoundContacts] = useState([]);
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [listName, setListName] = useState('');
    const [listDescription, setListDescription] = useState('');

    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // 1. Carregar Funis
    useEffect(() => {
        if (isOpen && organizacaoId) {
            const fetchFunnels = async () => {
                const { data } = await supabase
                    .from('funis')
                    .select('id, nome')
                    .eq('organizacao_id', organizacaoId);
                setFunnels(data || []);
            };
            fetchFunnels();
            
            setStep(1);
            setFilters({ funnelId: '', columnId: '', contactType: '', nameSearch: '' });
            setFoundContacts([]);
            setSelectedContacts([]);
            setListName('');
        }
    }, [isOpen, organizacaoId, supabase]);

    // 2. Carregar Colunas
    useEffect(() => {
        if (filters.funnelId) {
            const fetchColumns = async () => {
                const { data } = await supabase
                    .from('colunas_funil')
                    .select('id, nome')
                    .eq('funil_id', filters.funnelId)
                    .order('ordem');
                setColumns(data || []);
            };
            fetchColumns();
        } else {
            setColumns([]);
        }
    }, [filters.funnelId, supabase]);

    // 3. BUSCAR CONTATOS (CORRIGIDO: RELAÇÃO EXPLÍCITA)
    const handleSearch = async () => {
        if (!organizacaoId) {
            toast.error("Erro: Organização não identificada.");
            return;
        }

        setLoading(true);
        try {
            // AQUI ESTÁ A CORREÇÃO:
            // Usamos !contatos_no_funil_contato_id_fkey para dizer qual relação usar
            let query = supabase
                .from('contatos')
                .select(`
                    id, 
                    nome, 
                    tipo_contato, 
                    telefones!inner(telefone),
                    contatos_no_funil!contatos_no_funil_contato_id_fkey (coluna_id)
                `)
                .eq('organizacao_id', organizacaoId);

            if (filters.nameSearch) {
                query = query.ilike('nome', `%${filters.nameSearch}%`);
            }

            if (filters.contactType) {
                query = query.eq('tipo_contato', filters.contactType);
            }

            const { data, error } = await query;
            
            if (error) {
                throw error;
            }

            let filtered = data || [];

            // Filtragem em Memória
            filtered = filtered.filter(c => c.telefones && c.telefones.length > 0 && c.telefones[0].telefone);

            if (filters.funnelId || filters.columnId) {
                const validColumnIds = columns.map(c => c.id);

                filtered = filtered.filter(contact => {
                    // Normaliza array/objeto
                    const funilEntries = Array.isArray(contact.contatos_no_funil) 
                        ? contact.contatos_no_funil 
                        : (contact.contatos_no_funil ? [contact.contatos_no_funil] : []);
                    
                    if (funilEntries.length === 0) return false;

                    if (filters.columnId) {
                        return funilEntries.some(entry => entry.coluna_id === filters.columnId);
                    }
                    
                    if (filters.funnelId) {
                        return funilEntries.some(entry => validColumnIds.includes(entry.coluna_id));
                    }
                    
                    return true;
                });
            }

            const validContacts = filtered.map(c => ({
                id: c.id,
                nome: c.nome,
                telefone: c.telefones[0].telefone,
                tipo: c.tipo_contato
            }));

            setFoundContacts(validContacts);
            setSelectedContacts(validContacts.map(c => c.id));

            if (validContacts.length === 0) {
                toast.info("Nenhum contato encontrado com esses filtros.");
            } else {
                toast.success(`${validContacts.length} contatos encontrados!`);
            }

        } catch (error) {
            console.error("Erro detalhado:", error);
            // Mensagem de erro amigável se falhar a relação novamente
            if (error.message?.includes('relationship')) {
                toast.error("Erro técnico nas relações do banco. Contate o suporte.");
            } else {
                toast.error(`Erro na busca: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // 4. SALVAR A LISTA
    const handleSaveList = async () => {
        if (!listName.trim()) return toast.warning("Dê um nome para a lista.");
        if (selectedContacts.length === 0) return toast.warning("Selecione pelo menos um contato.");

        setLoading(true);
        try {
            const { data: listData, error: listError } = await supabase
                .from('whatsapp_broadcast_lists')
                .insert({
                    nome: listName,
                    descricao: listDescription,
                    filtros_usados: filters, 
                    organizacao_id: organizacaoId,
                    criado_por: user.id
                })
                .select()
                .single();

            if (listError) throw listError;

            const membersPayload = selectedContacts.map(contatoId => ({
                lista_id: listData.id,
                contato_id: contatoId
            }));

            const { error: membersError } = await supabase
                .from('whatsapp_list_members')
                .insert(membersPayload);

            if (membersError) throw membersError;

            toast.success("Lista criada com sucesso!");
            if (onListCreated) onListCreated();
            onClose();

        } catch (error) {
            console.error(error);
            toast.error(`Erro ao salvar: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleContact = (id) => {
        if (selectedContacts.includes(id)) {
            setSelectedContacts(prev => prev.filter(cid => cid !== id));
        } else {
            setSelectedContacts(prev => [...prev, id]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Criar Lista de Transmissão</h2>
                        <p className="text-sm text-gray-500">Passo {step} de 2: {step === 1 ? 'Filtrar Contatos' : 'Salvar Lista'}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
                </div>

                {/* Conteúdo */}
                <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
                    
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Funil de Vendas</label>
                                    <select 
                                        className="w-full border rounded-lg p-2.5 text-sm focus:ring-[#00a884]"
                                        value={filters.funnelId}
                                        onChange={(e) => setFilters({...filters, funnelId: e.target.value, columnId: ''})}
                                    >
                                        <option value="">Todos os Funis</option>
                                        {funnels.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Etapa (Coluna)</label>
                                    <select 
                                        className="w-full border rounded-lg p-2.5 text-sm focus:ring-[#00a884] disabled:bg-gray-100"
                                        value={filters.columnId}
                                        onChange={(e) => setFilters({...filters, columnId: e.target.value})}
                                        disabled={!filters.funnelId}
                                    >
                                        <option value="">Todas as Etapas</option>
                                        {columns.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Contato</label>
                                    <select 
                                        className="w-full border rounded-lg p-2.5 text-sm focus:ring-[#00a884]"
                                        value={filters.contactType}
                                        onChange={(e) => setFilters({...filters, contactType: e.target.value})}
                                    >
                                        <option value="">Todos os Tipos</option>
                                        {types.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por Nome</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            className="w-full border rounded-lg p-2.5 pl-9 text-sm focus:ring-[#00a884]"
                                            placeholder="Nome..."
                                            value={filters.nameSearch}
                                            onChange={(e) => setFilters({...filters, nameSearch: e.target.value})}
                                        />
                                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400 text-sm" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button 
                                    onClick={handleSearch} 
                                    disabled={loading}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFilter} />}
                                    Filtrar Contatos
                                </button>
                            </div>

                            {/* Resultados */}
                            {foundContacts.length > 0 && (
                                <div className="border rounded-lg mt-6 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="bg-gray-50 p-3 border-b flex justify-between items-center rounded-t-lg">
                                        <span className="font-semibold text-gray-700">Contatos Encontrados ({foundContacts.length})</span>
                                        <div className="text-sm">
                                            <span className="font-bold text-[#00a884]">{selectedContacts.length}</span> selecionados
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-2 custom-scrollbar">
                                        {foundContacts.map(contact => (
                                            <div 
                                                key={contact.id} 
                                                onClick={() => toggleContact(contact.id)}
                                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors mb-1 ${selectedContacts.includes(contact.id) ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'}`}
                                            >
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedContacts.includes(contact.id) ? 'bg-[#00a884] border-[#00a884]' : 'border-gray-400 bg-white'}`}>
                                                    {selectedContacts.includes(contact.id) && <FontAwesomeIcon icon={faCheck} className="text-white text-xs" />}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-800 text-sm">{contact.nome}</p>
                                                    <p className="text-xs text-gray-500">{contact.telefone} • {contact.tipo || 'Outro'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-3 border-t bg-gray-50 flex justify-end rounded-b-lg">
                                        <button 
                                            onClick={() => setStep(2)}
                                            disabled={selectedContacts.length === 0}
                                            className="bg-[#00a884] text-white px-6 py-2 rounded-lg hover:bg-[#008f6f] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                                        >
                                            Continuar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-center gap-4">
                                <div className="bg-blue-100 p-3 rounded-full text-blue-600"><FontAwesomeIcon icon={faUsers} size="lg"/></div>
                                <div>
                                    <h3 className="font-bold text-gray-800">Resumo da Lista</h3>
                                    <p className="text-sm text-gray-600">Você selecionou <span className="font-bold">{selectedContacts.length}</span> contatos para esta lista.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Lista *</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-3 focus:ring-[#00a884] outline-none transition-shadow"
                                    placeholder="Ex: Clientes Quentes Dezembro"
                                    value={listName}
                                    onChange={(e) => setListName(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (Opcional)</label>
                                <textarea 
                                    className="w-full border rounded-lg p-3 focus:ring-[#00a884] outline-none transition-shadow"
                                    placeholder="Para que serve esta lista?"
                                    rows={3}
                                    value={listDescription}
                                    onChange={(e) => setListDescription(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {step === 2 && (
                    <div className="p-5 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
                        <button onClick={() => setStep(1)} className="text-gray-600 hover:underline text-sm">Voltar e editar filtros</button>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
                            <button 
                                onClick={handleSaveList} 
                                disabled={loading || !listName.trim()}
                                className="bg-[#00a884] text-white px-6 py-2 rounded-lg hover:bg-[#008f6f] flex items-center gap-2 disabled:opacity-50 transition-all shadow-sm"
                            >
                                {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                                Salvar Lista
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}