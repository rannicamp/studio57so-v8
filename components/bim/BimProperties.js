// Caminho: components/bim/BimProperties.js
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faInfoCircle, 
    faTableList, 
    faSpinner, 
    faTimes, 
    faEye, 
    faEyeSlash, 
    faPencilAlt, 
    faCheck,
    faCube 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimProperties({ elementExternalId, projetoBimId, onClose }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { organizacao_id } = useAuth();

    const [showEmpty, setShowEmpty] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [tempValue, setTempValue] = useState('');

    // 1. BUSCA DADOS DO ELEMENTO COM FILTRO DUPLO (ID + PROJETO)
    const { data: elemento, isLoading } = useQuery({
        queryKey: ['bimElementProperties', elementExternalId, projetoBimId],
        queryFn: async () => {
            if (!elementExternalId || !projetoBimId) return null;
            
            const { data, error } = await supabase
                .from('elementos_bim')
                .select('*')
                .eq('projeto_bim_id', projetoBimId)
                .eq('external_id', elementExternalId)
                .maybeSingle(); // Use maybeSingle para não quebrar se não existir
            
            if (error) throw error;

            // Se não existe no banco, retornamos um template inicial
            return data || { 
                external_id: elementExternalId, 
                projeto_bim_id: projetoBimId,
                categoria: 'Elemento Nativo', 
                propriedades: {} 
            };
        },
        enabled: !!elementExternalId && !!projetoBimId,
    });

    // 2. SALVAMENTO COM UPSERT (Cria se não existe, atualiza se existe)
    const autoSave = async (key, newValue) => {
        // Evita salvar se o valor for igual
        if (elemento?.propriedades?.[key] === newValue) {
            setEditingKey(null);
            return;
        }

        try {
            const novasPropriedades = { 
                ...(elemento?.propriedades || {}), 
                [key]: newValue 
            };

            // Usamos UPSERT baseado na nossa constraint unique (projeto_bim_id, external_id)
            const { error } = await supabase
                .from('elementos_bim')
                .upsert({ 
                    organizacao_id,
                    projeto_bim_id: projetoBimId,
                    external_id: elementExternalId,
                    propriedades: novasPropriedades,
                    categoria: elemento?.categoria || 'Elemento Nativo',
                    atualizado_em: new Date() 
                }, { onConflict: 'projeto_bim_id, external_id' });

            if (error) throw error;

            toast.success(`"${key}" atualizado!`);
            
            // Atualiza o cache local imediatamente
            queryClient.invalidateQueries(['bimElementProperties', elementExternalId, projetoBimId]);

        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar: " + error.message);
        } finally {
            setEditingKey(null);
        }
    };

    const handleKeyDown = (e, key) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            autoSave(key, tempValue);
        }
        if (e.key === 'Escape') setEditingKey(null);
    };

    const renderProperties = () => {
        const props = elemento?.propriedades || {};
        const entries = Object.entries(props);

        if (entries.length === 0 && !showEmpty) {
            return (
                <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-[10px] font-bold text-gray-400 uppercase italic">Nenhum parâmetro Studio 57</p>
                    <p className="text-[9px] text-gray-300 mt-1">Clique no ícone do olho para ver campos ocultos</p>
                </div>
            );
        }

        return entries
            .filter(([_, value]) => showEmpty || (value !== null && value !== ""))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => {
                const isThisEditing = editingKey === key;
                return (
                    <div key={key} className={`group p-2.5 rounded-lg border transition-all relative ${isThisEditing ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-gray-50 border-gray-100 hover:border-blue-200'}`}>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1 truncate pr-6">{key}</p>
                        <div className="relative min-h-[1.25rem]">
                            {isThisEditing ? (
                                <textarea 
                                    autoFocus
                                    rows={2}
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => autoSave(key, tempValue)}
                                    onKeyDown={(e) => handleKeyDown(e, key)}
                                    className="w-full text-xs font-bold text-blue-900 bg-white border border-blue-200 rounded p-1 outline-none resize-none"
                                />
                            ) : (
                                <p className="text-xs text-gray-700 font-bold leading-relaxed break-words pr-6 line-clamp-3">
                                    {String(value || '-')}
                                </p>
                            )}
                            {!isThisEditing && (
                                <button onClick={() => { setEditingKey(key); setTempValue(value); }} className="absolute top-[-18px] right-[-2px] opacity-0 group-hover:opacity-100 p-1 text-blue-500 hover:bg-blue-100 rounded-md transition-all">
                                    <FontAwesomeIcon icon={faPencilAlt} className="text-[10px]" />
                                </button>
                            )}
                        </div>
                    </div>
                );
            });
    };

    if (!elementExternalId) return null;

    return (
        <div className="w-80 min-w-[320px] bg-white border-l border-gray-200 h-full flex flex-col shadow-2xl z-30 overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 truncate">
                    <FontAwesomeIcon icon={faInfoCircle} className="text-blue-500 text-sm" />
                    <h3 className="text-[10px] font-black text-gray-700 uppercase tracking-widest truncate">Parâmetros Técnicos</h3>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowEmpty(!showEmpty)} className={`text-sm ${showEmpty ? 'text-blue-600' : 'text-gray-300'}`}>
                        <FontAwesomeIcon icon={showEmpty ? faEye : faEyeSlash} />
                    </button>
                    <button onClick={onClose} className="text-gray-300 hover:text-red-500"><FontAwesomeIcon icon={faTimes} /></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {isLoading ? (
                    <div className="flex justify-center p-10"><FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-2xl" /></div>
                ) : (
                    <>
                        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-3 shadow-lg relative overflow-hidden">
                            <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest">Categoria Selecionada</p>
                            <p className="text-xs font-bold text-white truncate">{elemento?.categoria}</p>
                            <FontAwesomeIcon icon={faCube} className="absolute -right-2 -bottom-2 text-4xl text-white/10" />
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                                <FontAwesomeIcon icon={faTableList} /> Propriedades do Elemento
                            </h4>
                            {renderProperties()}
                        </div>
                    </>
                )}
            </div>
            <div className="p-2 border-t bg-gray-50 text-[8px] text-gray-400 text-center font-bold uppercase tracking-tighter shrink-0">
                Vinculado ao ID: {elementExternalId}
            </div>
        </div>
    );
}