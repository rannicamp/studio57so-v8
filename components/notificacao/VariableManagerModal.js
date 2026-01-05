"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faLink, faTimes, faArrowDown, faSpinner, faSave, faList, faPlus, faTrash, faExchangeAlt 
} from '@fortawesome/free-solid-svg-icons';

// REMOVIDO: usePersistentState causava travamento ao trocar de contexto
// import { usePersistentState } from '@/hooks/usePersistentState';

export default function VariableManagerModal({ isOpen, onClose, tabelaGatilho, tabelas, campos }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    
    // Controle de Abas: 'list' ou 'create'
    const [activeTab, setActiveTab] = useState('list');

    // DEVONILDO FIX: Usando useState normal para garantir que o formulário limpe ao mudar de tabela
    const [formData, setFormData] = useState({
        tabela_gatilho: tabelaGatilho || '',
        coluna_origem: '',
        tabela_destino: '',
        coluna_chave_destino: 'id',
        coluna_retorno: '',
        nome_variavel: ''
    });

    // DEVONILDO FIX: Reset completo quando a tabela gatilho muda
    useEffect(() => {
        if(tabelaGatilho) {
            setFormData({
                tabela_gatilho: tabelaGatilho,
                coluna_origem: '',
                tabela_destino: '',
                coluna_chave_destino: 'id',
                coluna_retorno: '',
                nome_variavel: ''
            });
            // Sempre volta para a lista ao abrir em uma nova tabela
            setActiveTab('list');
        }
    }, [tabelaGatilho]); // Removida dependência de setFormData para evitar loops

    // --- QUERY: Buscar Variáveis Existentes ---
    const { data: variaveisExistentes = [], isLoading: isLoadingList } = useQuery({
        queryKey: ['variaveis_virtuais', tabelaGatilho],
        queryFn: async () => {
            if (!tabelaGatilho) return [];
            const { data, error } = await supabase
                .from('variaveis_virtuais')
                .select('*')
                .eq('tabela_gatilho', tabelaGatilho)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: isOpen && !!tabelaGatilho 
    });

    // --- MUTATION: Criar ---
    const createMutation = useMutation({
        mutationFn: async (dados) => {
            const { data: { user } } = await supabase.auth.getUser();
            
            // Busca organização com segurança
            const { data: userData, error: userError } = await supabase
                .from('usuarios')
                .select('organizacao_id')
                .eq('id', user.id)
                .single();

            if (userError || !userData) throw new Error("Erro ao identificar organização do usuário.");

            const { error } = await supabase.from('variaveis_virtuais').insert({
                ...dados,
                organizacao_id: userData.organizacao_id
            });
            if(error) throw error;
        },
        onSuccess: () => {
            toast.success("Variável criada com sucesso!");
            queryClient.invalidateQueries(['variaveis_virtuais']);
            
            // Limpa campos específicos e volta pra lista
            setFormData(prev => ({
                ...prev, 
                nome_variavel: '', 
                coluna_retorno: '',
                // Mantém a origem e destino para facilitar criações em massa se quiser
            })); 
            setActiveTab('list');
        },
        onError: (err) => toast.error("Erro ao criar: " + err.message)
    });

    // --- MUTATION: Deletar ---
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('variaveis_virtuais').delete().eq('id', id);
            if(error) throw error;
        },
        onSuccess: () => {
            toast.success("Variável removida.");
            queryClient.invalidateQueries(['variaveis_virtuais']);
        },
        onError: (err) => toast.error("Erro ao deletar: " + err.message)
    });

    // --- Dados Computados para o Form (Com proteção contra undefined) ---
    const colunasOrigem = useMemo(() => {
        if (!tabelas || !campos) return [];
        const tab = tabelas.find(t => t.nome_tabela === formData.tabela_gatilho);
        return tab ? campos.filter(c => c.tabela_id === tab.id) : [];
    }, [formData.tabela_gatilho, tabelas, campos]);

    const colunasDestino = useMemo(() => {
        if (!tabelas || !campos) return [];
        const tab = tabelas.find(t => t.nome_tabela === formData.tabela_destino);
        return tab ? campos.filter(c => c.tabela_id === tab.id) : [];
    }, [formData.tabela_destino, tabelas, campos]);

    const handleSave = () => {
        if(!formData.coluna_origem || !formData.tabela_destino || !formData.coluna_retorno || !formData.nome_variavel) {
            toast.error("Por favor, preencha todos os campos do link.");
            return;
        }
        createMutation.mutate(formData);
    };

    if(!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
                
                {/* HEADER */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center text-white shrink-0">
                    <h3 className="font-bold flex items-center gap-2">
                        <FontAwesomeIcon icon={faLink} /> Gerenciador de Links
                        <span className="bg-white/20 text-xs px-2 py-0.5 rounded font-mono">
                            {tabelaGatilho || 'Geral'}
                        </span>
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full w-8 h-8 flex items-center justify-center transition-colors">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                {/* TABS */}
                <div className="flex border-b border-gray-100 shrink-0">
                    <button 
                        onClick={() => setActiveTab('list')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'list' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <FontAwesomeIcon icon={faList} /> Minhas Variáveis
                    </button>
                    <button 
                        onClick={() => setActiveTab('create')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'create' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <FontAwesomeIcon icon={faPlus} /> Nova Conexão
                    </button>
                </div>

                {/* CONTENT AREA */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
                    
                    {/* --- VIEW: LISTA --- */}
                    {activeTab === 'list' && (
                        <div className="space-y-4">
                            {isLoadingList ? (
                                <div className="text-center py-10 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>
                            ) : variaveisExistentes.length === 0 ? (
                                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                                    <p className="text-gray-400 text-sm mb-2">Nenhum link criado para esta tabela.</p>
                                    <button onClick={() => setActiveTab('create')} className="text-purple-600 font-bold text-xs hover:underline">
                                        Criar o primeiro
                                    </button>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {variaveisExistentes.map((item) => (
                                        <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex justify-between items-center group hover:border-purple-200 transition-colors">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-xs border border-purple-100">
                                                        {`{${item.nome_variavel}}`}
                                                    </span>
                                                    <FontAwesomeIcon icon={faArrowDown} className="text-gray-300 text-[10px] -rotate-90" />
                                                    <span className="text-xs font-bold text-gray-700">{item.tabela_destino}.{item.coluna_retorno}</span>
                                                </div>
                                                <p className="text-[10px] text-gray-400">
                                                    Link via: <strong>{item.coluna_origem}</strong> &rarr; {item.coluna_chave_destino}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => { if(confirm('Excluir esta variável?')) deleteMutation.mutate(item.id) }}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                title="Excluir"
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- VIEW: CRIAÇÃO --- */}
                    {activeTab === 'create' && (
                        <div className="space-y-6 animate-fade-in">
                            <p className="text-sm text-gray-500 bg-purple-50 p-3 rounded-lg border border-purple-100">
                                Configure como o sistema deve buscar dados em outras tabelas.
                            </p>

                            <div className="space-y-4">
                                {/* PASSO 1: ORIGEM */}
                                <div className="grid grid-cols-2 gap-4 items-end">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tabela Atual</label>
                                        <div className="p-2 bg-gray-100 rounded text-sm font-mono text-gray-700 border border-gray-200">
                                            {formData.tabela_gatilho || 'Selecione no formulário principal'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-purple-600 uppercase mb-1">Coluna FK (Ligação)</label>
                                        <select 
                                            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                            value={formData.coluna_origem}
                                            onChange={e => setFormData({...formData, coluna_origem: e.target.value})}
                                        >
                                            <option value="">Selecione...</option>
                                            {colunasOrigem.map(c => <option key={c.id} value={c.nome_coluna}>{c.nome_coluna}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-center text-gray-300"><FontAwesomeIcon icon={faExchangeAlt} className="rotate-90" /></div>

                                {/* PASSO 2: DESTINO */}
                                <div className="p-4 border border-purple-100 rounded-xl bg-purple-50/50 space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-purple-600 uppercase mb-1">Buscar na Tabela</label>
                                        <select 
                                            className="w-full p-2 border border-purple-200 rounded text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                            value={formData.tabela_destino}
                                            onChange={e => setFormData({...formData, tabela_destino: e.target.value})}
                                        >
                                            <option value="">Selecione a tabela destino...</option>
                                            {tabelas.map(t => <option key={t.id} value={t.nome_tabela}>{t.nome_exibicao} ({t.nome_tabela})</option>)}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ID Alvo</label>
                                            <input 
                                                className="w-full p-2 border border-gray-200 rounded text-sm bg-white text-gray-500"
                                                value={formData.coluna_chave_destino}
                                                onChange={e => setFormData({...formData, coluna_chave_destino: e.target.value})}
                                                placeholder="Geralmente 'id'"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-green-600 uppercase mb-1">Dado para exibir</label>
                                            <select 
                                                className="w-full p-2 border border-green-200 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white"
                                                value={formData.coluna_retorno}
                                                onChange={e => setFormData({...formData, coluna_retorno: e.target.value})}
                                            >
                                                <option value="">Selecione o campo...</option>
                                                {colunasDestino.map(c => <option key={c.id} value={c.nome_coluna}>{c.nome_coluna}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* PASSO 3: NOME DA VARIÁVEL */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nome da Variável (Como vai usar)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-400 font-bold">{'{'}</span>
                                        <input 
                                            className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded font-bold text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none"
                                            value={formData.nome_variavel}
                                            onChange={e => setFormData({...formData, nome_variavel: e.target.value.replace(/[{}]/g, '').toLowerCase().replace(/\s/g, '_')})}
                                            placeholder="ex: nome_cliente"
                                        />
                                        <span className="absolute right-3 top-2 text-gray-400 font-bold">{'}'}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">Dica: Use nomes fáceis de lembrar.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-4 bg-gray-5 border-t flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                        Fechar
                    </button>
                    
                    {activeTab === 'create' && (
                        <button 
                            onClick={handleSave} 
                            disabled={createMutation.isPending}
                            className="px-6 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-md flex items-center gap-2 disabled:opacity-50"
                        >
                            {createMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                            Salvar Link
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}