"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faTimes, faArrowDown, faSpinner, faSave } from '@fortawesome/free-solid-svg-icons';
// Importação do hook de persistência
import { usePersistentState } from '@/hooks/usePersistentState';

export default function VariableBuilderModal({ isOpen, onClose, tabelaGatilho, tabelas, campos }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    
    // SUBSTITUÍDO useState POR usePersistentState
    const [formData, setFormData] = usePersistentState('notif_varBuilder', {
        tabela_gatilho: tabelaGatilho || '',
        coluna_origem: '',
        tabela_destino: '',
        coluna_chave_destino: 'id',
        coluna_retorno: '',
        nome_variavel: ''
    });

    useEffect(() => {
        if(tabelaGatilho) setFormData(prev => ({...prev, tabela_gatilho: tabelaGatilho}));
    }, [tabelaGatilho, setFormData]);

    const colunasOrigem = useMemo(() => {
        const tab = tabelas.find(t => t.nome_tabela === formData.tabela_gatilho);
        return tab ? campos.filter(c => c.tabela_id === tab.id) : [];
    }, [formData.tabela_gatilho, tabelas, campos]);

    const colunasDestino = useMemo(() => {
        const tab = tabelas.find(t => t.nome_tabela === formData.tabela_destino);
        return tab ? campos.filter(c => c.tabela_id === tab.id) : [];
    }, [formData.tabela_destino, tabelas, campos]);

    const handleSave = async () => {
        if(!formData.coluna_origem || !formData.tabela_destino || !formData.coluna_retorno || !formData.nome_variavel) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: userData } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();

            const { error } = await supabase.from('variaveis_virtuais').insert({
                ...formData,
                organizacao_id: userData.organizacao_id
            });

            if(error) throw error;

            toast.success("Variável linkada criada com sucesso!");
            queryClient.invalidateQueries(['variaveis_virtuais']);
            
            // Limpa o estado persistente do modal
            setFormData({
                tabela_gatilho: tabelaGatilho || '',
                coluna_origem: '',
                tabela_destino: '',
                coluna_chave_destino: 'id',
                coluna_retorno: '',
                nome_variavel: ''
            });
            localStorage.removeItem('notif_varBuilder'); // Garante limpeza no storage

            onClose();
        } catch (error) {
            toast.error("Erro ao criar variável: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if(!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2">
                        <FontAwesomeIcon icon={faLink} /> Linkador de Variáveis
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full w-8 h-8 flex items-center justify-center transition-colors">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <p className="text-sm text-gray-500 bg-purple-50 p-3 rounded-lg border border-purple-100">
                        Ensine o sistema a buscar dados em outras tabelas. <br/>
                        Ex: <strong>Contrato</strong> tem <em>contato_id</em> &rarr; Buscar <em>Nome</em> em <strong>Contatos</strong>.
                    </p>

                    <div className="space-y-4">
                        {/* PASSO 1: ORIGEM */}
                        <div className="grid grid-cols-2 gap-4 items-end">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tabela Atual</label>
                                <div className="p-2 bg-gray-100 rounded text-sm font-mono text-gray-700 border border-gray-200">
                                    {formData.tabela_gatilho || 'Selecione no formulário'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-purple-600 uppercase mb-1">Coluna de Ligação (FK)</label>
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

                        <div className="flex justify-center text-gray-300"><FontAwesomeIcon icon={faArrowDown} /></div>

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
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Onde ID é igual a</label>
                                    <input 
                                        className="w-full p-2 border border-gray-200 rounded text-sm bg-white text-gray-500"
                                        value={formData.coluna_chave_destino}
                                        onChange={e => setFormData({...formData, coluna_chave_destino: e.target.value})}
                                        placeholder="id"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-green-600 uppercase mb-1">Pegar o valor de</label>
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
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nome da Variável (Alias)</label>
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
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
                    <button 
                        onClick={handleSave} 
                        disabled={loading}
                        className="px-6 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-md flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                        Criar Link
                    </button>
                </div>
            </div>
        </div>
    );
}