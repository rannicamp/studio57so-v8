// Caminho: components/bim/BimProperties.js
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faInfoCircle, faSpinner, faTimes, 
    faEye, faEyeSlash, faPencilAlt, faCube 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimProperties({ elementExternalId, projetoBimId, urnAutodesk, onClose }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { organizacao_id } = useAuth();

    const [showEmpty, setShowEmpty] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [tempValue, setTempValue] = useState('');

    useEffect(() => {
        setEditingKey(null);
        setTempValue('');
    }, [elementExternalId, urnAutodesk]);

    const { data: elemento, isLoading, isFetching } = useQuery({
        queryKey: ['bimElementProperties', elementExternalId, urnAutodesk],
        queryFn: async () => {
            if (!elementExternalId) return null;
            
            // Limpeza de segurança (embora o page.js já envie limpo)
            const cleanUrn = urnAutodesk ? urnAutodesk.replace(/^urn:/, '').trim() : null;

            console.log(`[Studio 57] Buscando propriedades: ExtID=${elementExternalId}, URN=${cleanUrn}`);

            let query = supabase.from('elementos_bim')
                .select('*')
                .eq('external_id', elementExternalId);
            
            // FILTRAGEM CRÍTICA: Garante que pegamos o elemento do modelo CERTO
            if (cleanUrn) {
                query = query.eq('urn_autodesk', cleanUrn);
            } else if (projetoBimId) {
                // Fallback se a URN falhar
                query = query.eq('projeto_bim_id', projetoBimId);
            }

            const { data, error } = await query.maybeSingle(); 
            
            if (error) {
                console.error("Erro Supabase:", error);
                throw error;
            }

            return data || { 
                external_id: elementExternalId, 
                urn_autodesk: cleanUrn,
                projeto_bim_id: projetoBimId,
                categoria: 'Elemento Nativo', 
                propriedades: {} 
            };
        },
        enabled: !!elementExternalId,
    });

    const autoSave = async (key, newValue) => {
        if (elemento?.propriedades?.[key] === newValue) {
            setEditingKey(null);
            return;
        }

        try {
            const novasPropriedades = { ...(elemento?.propriedades || {}), [key]: newValue };
            const cleanUrn = urnAutodesk?.replace(/^urn:/, '').trim();

            const { error } = await supabase
                .from('elementos_bim')
                .upsert({ 
                    organizacao_id,
                    projeto_bim_id: elemento.projeto_bim_id || projetoBimId, // Prioriza o ID existente
                    urn_autodesk: cleanUrn,
                    external_id: elementExternalId,
                    propriedades: novasPropriedades,
                    categoria: elemento?.categoria || 'Elemento Nativo',
                    atualizado_em: new Date() 
                }, { onConflict: 'projeto_bim_id, external_id' });

            if (error) throw error;
            toast.success(`Parâmetro atualizado!`);
            queryClient.invalidateQueries(['bimElementProperties']);
        } catch (error) {
            toast.error("Erro ao salvar: " + error.message);
        } finally {
            setEditingKey(null);
        }
    };

    const renderProperties = () => {
        const props = elemento?.propriedades || {};
        const entries = Object.entries(props);
        if (entries.length === 0 && !showEmpty) {
            return (
                <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-[10px] font-black text-gray-400 uppercase italic tracking-tighter">Nenhum parâmetro Studio 57 vinculado</p>
                </div>
            );
        }
        return entries.filter(([_, v]) => showEmpty || (v !== null && v !== "")).map(([key, value]) => {
            const isEditing = editingKey === key;
            return (
                <div key={key} className={`group p-2.5 rounded-lg border transition-all relative ${isEditing ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100 hover:border-blue-100'}`}>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate pr-6">{key}</p>
                    <div className="relative min-h-[1.25rem]">
                        {isEditing ? (
                            <textarea autoFocus value={tempValue} onChange={(e) => setTempValue(e.target.value)} onBlur={() => autoSave(key, tempValue)} className="w-full text-xs font-bold text-blue-900 bg-white border border-blue-200 rounded p-1 outline-none resize-none" />
                        ) : (
                            <p className="text-xs text-gray-700 font-bold leading-relaxed break-words pr-6 line-clamp-4">{String(value || '-')}</p>
                        )}
                        {!isEditing && (
                            <button onClick={() => { setEditingKey(key); setTempValue(value); }} className="absolute top-[-18px] right-[-2px] opacity-0 group-hover:opacity-100 p-1 text-blue-500 hover:bg-blue-100 rounded-md transition-all">
                                <FontAwesomeIcon icon={faPencilAlt} className="text-[10px]" />
                            </button>
                        )}
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-2xl z-30 animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 truncate">
                    {isFetching ? <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" /> : <FontAwesomeIcon icon={faInfoCircle} className="text-blue-500" />}
                    <h3 className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Painel de Dados</h3>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowEmpty(!showEmpty)} className={`text-sm ${showEmpty ? 'text-blue-600' : 'text-gray-300'}`}><FontAwesomeIcon icon={showEmpty ? faEye : faEyeSlash} /></button>
                    <button onClick={onClose} className="text-gray-300 hover:text-red-500"><FontAwesomeIcon icon={faTimes} /></button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-3 shadow-lg relative overflow-hidden text-white">
                    <p className="text-[8px] font-black uppercase text-blue-200 mb-1">ID do Elemento</p>
                    <p className="text-[10px] font-bold truncate">{elementExternalId}</p>
                    <div className="h-px bg-white/20 my-2" />
                    <p className="text-[8px] font-black uppercase text-blue-200 mb-1">DNA Modelo (URN)</p>
                    <p className="text-[9px] truncate opacity-80">{urnAutodesk ? urnAutodesk.substring(0, 30) : 'Nativa'}...</p>
                    <FontAwesomeIcon icon={faCube} className="absolute -right-2 -bottom-2 text-4xl text-white/10" />
                </div>
                <div className="space-y-2">{renderProperties()}</div>
            </div>
        </div>
    );
}