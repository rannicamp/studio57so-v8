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

export default function BimProperties({ elementExternalId, projetoBimId, urnAutodesk, onClose }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { organizacao_id } = useAuth();

    const [showEmpty, setShowEmpty] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [tempValue, setTempValue] = useState('');

    // --- 1. RESET DE ESTADO ---
    // Limpa campos de edição ao trocar de elemento ou modelo
    useEffect(() => {
        setEditingKey(null);
        setTempValue('');
    }, [elementExternalId, urnAutodesk]);

    // --- 2. BUSCA MESTRA (URN + EXTERNAL_ID) ---
    const { data: elemento, isLoading, isFetching } = useQuery({
        // A chave da query agora usa a URN como âncora de unicidade
        queryKey: ['bimElementProperties', elementExternalId, urnAutodesk],
        queryFn: async () => {
            if (!elementExternalId || !urnAutodesk) return null;
            
            // Removemos o prefixo 'urn:' caso ele venha do Viewer
            const cleanUrn = urnAutodesk.replace('urn:', '');

            const { data, error } = await supabase
                .from('elementos_bim')
                .select('*')
                .eq('urn_autodesk', cleanUrn) // Busca direta pelo DNA do arquivo
                .eq('external_id', elementExternalId)
                .maybeSingle(); 
            
            if (error) throw error;

            // Template para elementos que ainda não foram "processados" pelo extrator
            return data || { 
                external_id: elementExternalId, 
                urn_autodesk: cleanUrn,
                projeto_bim_id: projetoBimId,
                categoria: 'Elemento Nativo', 
                propriedades: {} 
            };
        },
        enabled: !!elementExternalId && !!urnAutodesk,
        staleTime: 1000 * 60 * 5 // Cache de 5 minutos para performance
    });

    // --- 3. SALVAMENTO INTELIGENTE (UPSERT) ---
    const autoSave = async (key, newValue) => {
        if (elemento?.propriedades?.[key] === newValue) {
            setEditingKey(null);
            return;
        }

        try {
            const novasPropriedades = { 
                ...(elemento?.propriedades || {}), 
                [key]: newValue 
            };

            const cleanUrn = urnAutodesk.replace('urn:', '');

            // Usamos a URN para garantir que o registro caia no modelo certo na federação
            const { error } = await supabase
                .from('elementos_bim')
                .upsert({ 
                    organizacao_id,
                    projeto_bim_id: projetoBimId, // Mantemos para herança de versão se necessário
                    urn_autodesk: cleanUrn,
                    external_id: elementExternalId,
                    propriedades: novasPropriedades,
                    categoria: elemento?.categoria || 'Elemento Nativo',
                    atualizado_em: new Date() 
                }, { onConflict: 'projeto_bim_id, external_id' });

            if (error) throw error;

            toast.success(`"${key}" atualizado!`);
            queryClient.invalidateQueries(['bimElementProperties', elementExternalId, urnAutodesk]);
        } catch (error) {
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
                    <p className="text-[10px] font-bold text-gray-400 uppercase italic">Sem parâmetros Studio 57</p>
                    <p className="text-[8px] text-gray-300 mt-1">Habilite a visualização para adicionar</p>
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

    if (!elementExternalId || !urnAutodesk) return null;

    return (
        <div className="w-80 min-w-[320px] bg-white border-l border-gray-200 h-full flex flex-col shadow-2xl z-30 overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 truncate">
                    {(isLoading || isFetching) ? (
                        <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />
                    ) : (
                        <FontAwesomeIcon icon={faInfoCircle} className="text-blue-500 text-sm" />
                    )}
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
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-3 shadow-lg relative overflow-hidden">
                    <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest">DNA do Modelo (URN)</p>
                    <p className="text-[10px] font-bold text-white truncate opacity-80 mb-1">{urnAutodesk.slice(-12)}</p>
                    <div className="h-px bg-white/20 my-1" />
                    <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest">Categoria</p>
                    <p className="text-xs font-bold text-white truncate">{elemento?.categoria}</p>
                    <FontAwesomeIcon icon={faCube} className="absolute -right-2 -bottom-2 text-4xl text-white/10" />
                </div>

                <div className="space-y-2">
                    <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                        <FontAwesomeIcon icon={faTableList} /> Propriedades Sincronizadas
                    </h4>
                    {renderProperties()}
                </div>
            </div>
            <div className="p-2 border-t bg-gray-50 text-[8px] text-gray-400 text-center font-bold uppercase tracking-tighter shrink-0">
                EXT ID: {elementExternalId} | S57 BIM ENGINE
            </div>
        </div>
    );
}