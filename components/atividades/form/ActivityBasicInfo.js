// Caminho: components/atividades/form/ActivityBasicInfo.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSitemap, faTimes } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function ActivityBasicInfo({ formData, setFormData, organizacaoId }) {
    const supabase = createClient();
    
    // Estados locais para a busca de Atividade Pai
    const [searchTerm, setSearchTerm] = useState('');
    const [options, setOptions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showOptions, setShowOptions] = useState(false);

    // CORREÇÃO: Buscando o nome da atividade pai usando a coluna correta 'atividade_pai_id'
    useEffect(() => {
        const fetchParentName = async () => {
            if (formData.atividade_pai_id && !searchTerm && organizacaoId) {
                const { data } = await supabase
                    .from('activities')
                    .select('nome')
                    .eq('id', formData.atividade_pai_id)
                    .single();
                if (data) setSearchTerm(data.nome);
            }
        };
        fetchParentName();
    }, [formData.atividade_pai_id, organizacaoId, supabase]);

    // Lógica de Busca
    const searchActivities = useCallback(async (term) => {
        if (term.length < 3 || !organizacaoId) return;
        
        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('activities')
                .select('id, nome')
                .eq('organizacao_id', organizacaoId)
                .ilike('nome', `%${term}%`)
                // Evita que a própria atividade seja pai dela mesma se estivermos editando
                .neq('id', formData.id || -1) 
                .limit(5);

            if (error) throw error;
            setOptions(data || []);
            setShowOptions(true);
        } catch (error) {
            console.error("Erro busca atividade pai:", error);
            toast.error("Erro ao buscar atividades.");
        } finally {
            setIsSearching(false);
        }
    }, [organizacaoId, supabase, formData.id]);

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            if (searchTerm && showOptions) {
                searchActivities(searchTerm);
            }
        }, 500);
        return () => clearTimeout(delayDebounce);
    }, [searchTerm, showOptions, searchActivities]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setShowOptions(true);
        if (e.target.value === '') {
            setFormData(prev => ({ ...prev, atividade_pai_id: null }));
        }
    };

    const handleSelectParent = (activity) => {
        setFormData(prev => ({ ...prev, atividade_pai_id: activity.id }));
        setSearchTerm(activity.nome);
        setShowOptions(false);
    };

    const handleClearParent = () => {
        setFormData(prev => ({ ...prev, atividade_pai_id: null }));
        setSearchTerm('');
        setOptions([]);
    };

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome da Atividade *</label>
                <input 
                    type="text" 
                    name="nome" 
                    value={formData.nome || ''} 
                    onChange={handleChange} 
                    required 
                    placeholder="Ex: Concretagem da Laje L1"
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                <textarea 
                    name="descricao" 
                    value={formData.descricao || ''} 
                    onChange={handleChange} 
                    rows="3" 
                    placeholder="Detalhes adicionais..."
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
            </div>

            <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-2">
                    Vincular à Atividade-Pai <span className="text-[9px] font-normal text-gray-400">(Opcional)</span>
                </label>
                
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FontAwesomeIcon icon={faSitemap} className="text-gray-400 text-sm" />
                    </div>
                    <input 
                        type="text" 
                        value={searchTerm} 
                        onChange={handleSearchChange}
                        onFocus={() => { if(searchTerm) setShowOptions(true) }}
                        placeholder="Digite para buscar a atividade principal..." 
                        className="w-full p-2.5 pl-9 pr-8 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {searchTerm && (
                        <button 
                            type="button" 
                            onClick={handleClearParent} 
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500 transition-colors"
                        >
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    )}
                </div>

                {showOptions && searchTerm.length >= 3 && (
                    <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-xl">
                        {isSearching ? (
                            <li className="px-4 py-3 text-xs text-gray-500 italic text-center">Buscando...</li>
                        ) : options.length > 0 ? (
                            options.map(activity => (
                                <li 
                                    key={activity.id} 
                                    onMouseDown={() => handleSelectParent(activity)}
                                    className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 border-b border-gray-50 last:border-0"
                                >
                                    {activity.nome}
                                </li>
                            ))
                        ) : (
                            <li className="px-4 py-3 text-xs text-gray-400 italic text-center">Nenhuma atividade encontrada.</li>
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}