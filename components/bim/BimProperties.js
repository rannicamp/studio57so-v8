// Caminho: components/bim/BimProperties.js
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
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
    faCube // <--- O IMPORT QUE FALTAVA, SEU LINDO!
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimProperties({ elementExternalId, projetoBimId, onClose }) {
    const supabase = createClient();
    const queryClient = useQueryClient();

    // ESTADOS
    const [showEmpty, setShowEmpty] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [tempValue, setTempValue] = useState('');

    // 1. BUSCA DADOS DO ELEMENTO
    const { data: elemento, isLoading } = useQuery({
        queryKey: ['bimElementProperties', elementExternalId, projetoBimId],
        queryFn: async () => {
            if (!elementExternalId) return null;
            const { data, error } = await supabase
                .from('elementos_bim')
                .select('*')
                .eq('projeto_bim_id', projetoBimId)
                .eq('external_id', elementExternalId)
                .single();
            
            if (error) throw error;
            return data;
        },
        enabled: !!elementExternalId,
    });

    // 2. FUNÇÃO DE SALVAMENTO AUTOMÁTICO
    const autoSave = async (key, newValue) => {
        if (elemento.propriedades[key] === newValue) {
            setEditingKey(null);
            return;
        }

        try {
            const novasPropriedades = { 
                ...elemento.propriedades, 
                [key]: newValue 
            };

            const { error } = await supabase
                .from('elementos_bim')
                .update({ 
                    propriedades: novasPropriedades,
                    atualizado_em: new Date() 
                })
                .eq('id', elemento.id);

            if (error) throw error;

            toast.success(`"${key}" atualizado!`);
            
            queryClient.setQueryData(['bimElementProperties', elementExternalId, projetoBimId], (old) => ({
                ...old,
                propriedades: novasPropriedades
            }));

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

    // 3. RENDERIZAÇÃO DAS LINHAS
    const renderProperties = () => {
        if (!elemento?.propriedades) return null;

        return Object.entries(elemento.propriedades)
            .filter(([_, value]) => {
                if (showEmpty) return true;
                return value !== null && value !== "" && value !== 0 && value !== "0";
            })
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => {
                const isThisEditing = editingKey === key;

                return (
                    <div 
                        key={key} 
                        className={`
                            group p-2.5 rounded-lg border transition-all relative overflow-hidden w-full max-w-full
                            ${isThisEditing ? 'bg-blue-50 border-blue-300 shadow-inner' : 'bg-gray-50 border-gray-100 hover:border-blue-200'}
                        `}
                        title={!isThisEditing ? String(value || 'Vazio') : ''}
                    >
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1 block truncate pr-6">
                            {key}
                        </p>
                        
                        <div className="relative min-h-[1.25rem]">
                            {isThisEditing ? (
                                <textarea 
                                    autoFocus
                                    rows={3}
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => autoSave(key, tempValue)}
                                    onKeyDown={(e) => handleKeyDown(e, key)}
                                    className="w-full text-xs font-bold text-blue-900 bg-white border border-blue-200 rounded p-1 outline-none resize-none"
                                />
                            ) : (
                                <p className="text-xs text-gray-700 font-medium leading-relaxed break-words pr-6 line-clamp-3">
                                    {String(value || '-')}
                                </p>
                            )}

                            {!isThisEditing && (
                                <button 
                                    onClick={() => { setEditingKey(key); setTempValue(value); }}
                                    className="absolute top-[-18px] right-[-2px] opacity-0 group-hover:opacity-100 p-1.5 text-blue-500 hover:bg-blue-100 rounded-md transition-all z-10"
                                >
                                    <FontAwesomeIcon icon={faPencilAlt} className="text-[10px]" />
                                </button>
                            )}

                            {isThisEditing && (
                                <div className="absolute bottom-1 right-1">
                                    <FontAwesomeIcon icon={faCheck} className="text-green-500 text-[10px] animate-bounce" />
                                </div>
                            )}
                        </div>
                    </div>
                );
            });
    };

    if (!elementExternalId) return null;

    return (
        <div className="w-80 min-w-[320px] max-w-[320px] bg-white border-l border-gray-200 h-full flex flex-col shadow-2xl animate-fade-in-right z-30 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 truncate">
                    <FontAwesomeIcon icon={faInfoCircle} className="text-blue-500 text-sm" />
                    <h3 className="text-[10px] font-black text-gray-700 uppercase tracking-widest truncate">Parâmetros Técnicos</h3>
                </div>
                
                <div className="flex items-center gap-4 shrink-0">
                    <button 
                        onClick={() => setShowEmpty(!showEmpty)}
                        className={`text-sm transition-all ${showEmpty ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}`}
                        title={showEmpty ? "Ocultar campos vazios" : "Mostrar campos vazios"}
                    >
                        <FontAwesomeIcon icon={showEmpty ? faEye : faEyeSlash} />
                    </button>
                    <button onClick={onClose} className="text-gray-300 hover:text-red-500 transition-colors">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-white">
                {isLoading ? (
                    <div className="p-10 text-center text-blue-500"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                ) : elemento ? (
                    <div className="p-4 space-y-4">
                        {/* Banner de Categoria */}
                        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-3 shadow-lg shadow-blue-100 relative overflow-hidden">
                            <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest">Categoria</p>
                            <p className="text-xs font-bold text-white truncate pr-2" title={elemento.categoria}>{elemento.categoria}</p>
                            <FontAwesomeIcon icon={faCube} className="absolute -right-2 -bottom-2 text-4xl text-white/10" />
                        </div>

                        {/* Lista de Propriedades */}
                        <div className="space-y-2 pb-10">
                            <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                                <FontAwesomeIcon icon={faTableList} /> Atributos Sincronizados
                            </h4>
                            <div className="flex flex-col gap-2">
                                {renderProperties()}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-10 text-center text-gray-300 italic text-xs">Buscando informações...</div>
                )}
            </div>

            {/* Rodapé fixo */}
            <div className="p-2 border-t bg-gray-50 text-[8px] text-gray-400 text-center font-bold uppercase tracking-tighter shrink-0">
                Clique no lápis para editar • Esc para cancelar
            </div>
        </div>
    );
}