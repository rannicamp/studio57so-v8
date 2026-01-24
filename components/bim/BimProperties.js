// Caminho: components/bim/BimProperties.js
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faInfoCircle, faTableList, faSpinner, faTimes, 
    faEye, faEyeSlash, faPencilAlt, faCheck 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimProperties({ elementExternalId, projetoBimId, onClose }) {
    const supabase = createClient();
    const queryClient = useQueryClient();

    // ESTADOS
    const [showEmpty, setShowEmpty] = useState(false);
    const [editingKey, setEditingKey] = useState(null); // Qual campo está sendo editado?
    const [tempValue, setTempValue] = useState(''); // Valor temporário enquanto digita

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
        // Se o valor não mudou, nem gasta banco
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
            
            // Atualiza o cache local para o visual refletir a mudança
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
        if (e.key === 'Enter') autoSave(key, tempValue);
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
            .sort(([a], [b]) => a.localeCompare(b)) // Ordena por nome da propriedade
            .map(([key, value]) => {
                const isThisEditing = editingKey === key;

                return (
                    <div 
                        key={key} 
                        className={`
                            group p-2 rounded border transition-all relative
                            ${isThisEditing ? 'bg-blue-50 border-blue-300 shadow-inner' : 'bg-gray-50 border-gray-100 hover:border-blue-200'}
                        `}
                    >
                        {/* Label da Propriedade */}
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mb-0.5">
                            {key}
                        </p>
                        
                        <div className="flex items-center justify-between gap-2">
                            {isThisEditing ? (
                                <input 
                                    autoFocus
                                    type="text"
                                    value={tempValue}
                                    onChange={(e) => setTempValue(e.target.value)}
                                    onBlur={() => autoSave(key, tempValue)}
                                    onKeyDown={(e) => handleKeyDown(e, key)}
                                    className="flex-1 text-xs font-bold text-blue-900 bg-transparent outline-none"
                                />
                            ) : (
                                <p className="flex-1 text-xs text-gray-700 font-medium break-words leading-tight">
                                    {String(value || '-')}
                                </p>
                            )}

                            {/* Ícone de Lápis (Aparece no Hover) */}
                            {!isThisEditing && (
                                <button 
                                    onClick={() => { setEditingKey(key); setTempValue(value); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-blue-500 hover:bg-blue-100 rounded transition-all"
                                >
                                    <FontAwesomeIcon icon={faPencilAlt} className="text-[10px]" />
                                </button>
                            )}

                            {/* Ícone de Check (Só no modo edição) */}
                            {isThisEditing && (
                                <FontAwesomeIcon icon={faCheck} className="text-green-500 text-[10px] animate-pulse" />
                            )}
                        </div>
                    </div>
                );
            });
    };

    if (!elementExternalId) return null;

    return (
        <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-2xl animate-fade-in-right z-30">
            {/* Header Compacto */}
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faInfoCircle} className="text-blue-500 text-sm" />
                    <h3 className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Parâmetros</h3>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* Toggle de Vazios */}
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
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <div className="p-10 text-center text-blue-500"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                ) : elemento ? (
                    <div className="p-4 space-y-4">
                        {/* Banner de Categoria (Não editável aqui, pois é um campo fixo) */}
                        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-3 shadow-lg shadow-blue-100">
                            <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest">Elemento / Categoria</p>
                            <p className="text-xs font-bold text-white truncate">{elemento.categoria}</p>
                        </div>

                        {/* Listagem de Propriedades */}
                        <div className="space-y-2 pb-10">
                            <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                                <FontAwesomeIcon icon={faTableList} /> Dados do Banco
                            </h4>
                            <div className="grid gap-1.5">
                                {renderProperties()}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-10 text-center text-gray-300 italic text-xs">Aguardando sincronização...</div>
                )}
            </div>

            {/* Rodapé Informativo */}
            <div className="p-2 border-t bg-gray-50 text-[8px] text-gray-400 text-center font-bold uppercase tracking-tighter">
                Edição direta ativa • Pressione Enter para salvar
            </div>
        </div>
    );
}