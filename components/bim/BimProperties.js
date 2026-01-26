// Caminho: components/bim/BimProperties.js
'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faEye, faEyeSlash, faPencilAlt, faCube 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimProperties({ elementExternalId, projetoBimId, urnAutodesk }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { organizacao_id } = useAuth();

    const [showEmpty, setShowEmpty] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [tempValue, setTempValue] = useState('');

    // Busca de Dados
    const { data: elemento, isLoading, isFetching } = useQuery({
        queryKey: ['bimElementProperties', elementExternalId, urnAutodesk],
        queryFn: async () => {
            if (!elementExternalId) return null;
            const cleanUrn = urnAutodesk ? urnAutodesk.replace(/^urn:/, '').trim() : null;

            // Tenta buscar no nosso banco (metadados extraídos/editados)
            let query = supabase.from('elementos_bim')
                .select('*')
                .eq('external_id', elementExternalId);
            
            if (cleanUrn) query = query.eq('urn_autodesk', cleanUrn);
            else if (projetoBimId) query = query.eq('projeto_bim_id', projetoBimId);

            const { data, error } = await query.maybeSingle(); 
            if (error) throw error;

            return data || { 
                external_id: elementExternalId, 
                propriedades: {} 
            };
        },
        enabled: !!elementExternalId,
    });

    // Função de Salvar Edição
    const autoSave = async (key, newValue) => {
        if (elemento?.propriedades?.[key] === newValue) { setEditingKey(null); return; }
        
        try {
            const novasPropriedades = { ...(elemento?.propriedades || {}), [key]: newValue };
            const cleanUrn = urnAutodesk?.replace(/^urn:/, '').trim();
            
            const { error } = await supabase.from('elementos_bim').upsert({ 
                organizacao_id, 
                projeto_bim_id: elemento.projeto_bim_id || projetoBimId, 
                urn_autodesk: cleanUrn, 
                external_id: elementExternalId,
                propriedades: novasPropriedades, 
                categoria: elemento?.categoria || 'Elemento Nativo',
                atualizado_em: new Date() 
            }, { onConflict: 'projeto_bim_id, external_id' });

            if (error) throw error;
            toast.success(`Propriedade atualizada!`);
            queryClient.invalidateQueries(['bimElementProperties']);
        } catch (error) { 
            toast.error("Erro ao salvar propriedade."); 
            console.error(error);
        } finally { 
            setEditingKey(null); 
        }
    };

    // Renderização da Lista
    const renderProperties = () => {
        const props = elemento?.propriedades || {};
        const entries = Object.entries(props);

        if (entries.length === 0 && !showEmpty) {
            return (
                <div className="flex flex-col items-center justify-center h-40 text-center border-2 border-dashed border-gray-200 rounded-lg m-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Nenhuma propriedade extraída</p>
                    <p className="text-[9px] text-gray-300 mt-1">Clique em "Sincronizar" no menu lateral</p>
                </div>
            );
        }

        return entries.filter(([_, v]) => showEmpty || (v !== null && v !== "")).map(([key, value]) => {
            const isEditing = editingKey === key;
            return (
                <div key={key} className={`group p-2.5 rounded-lg border transition-all relative ${isEditing ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate pr-6">{key}</p>
                    
                    <div className="relative min-h-[1.25rem]">
                        {isEditing ? (
                            <textarea 
                                autoFocus 
                                value={tempValue} 
                                onChange={(e) => setTempValue(e.target.value)} 
                                onBlur={() => autoSave(key, tempValue)} 
                                className="w-full text-xs font-bold text-blue-900 bg-white border border-blue-200 rounded p-1 outline-none resize-none shadow-inner"
                                rows={2}
                            />
                        ) : (
                            <p className="text-xs text-gray-700 font-medium leading-relaxed break-words pr-6 line-clamp-4 cursor-text" onClick={() => { setEditingKey(key); setTempValue(value); }}>
                                {String(value || '-')}
                            </p>
                        )}
                        
                        {!isEditing && (
                            <button 
                                onClick={() => { setEditingKey(key); setTempValue(value); }} 
                                className="absolute top-[-20px] right-[-4px] opacity-0 group-hover:opacity-100 p-1.5 text-blue-400 hover:text-blue-600 transition-all"
                            >
                                <FontAwesomeIcon icon={faPencilAlt} className="text-[10px]" />
                            </button>
                        )}
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header Interno do Conteúdo (Detalhes do ID) */}
            <div className="p-4 bg-white border-b border-gray-100 shadow-[0_4px_10px_-5px_rgba(0,0,0,0.05)] z-10">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3 shadow-md relative overflow-hidden text-white mb-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[8px] font-bold uppercase text-gray-400 mb-0.5">External ID</p>
                            <p className="text-[10px] font-mono text-white break-all">{elementExternalId}</p>
                        </div>
                        <FontAwesomeIcon icon={faCube} className="text-gray-700 text-2xl" />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button onClick={() => setShowEmpty(!showEmpty)} className={`text-[10px] font-bold flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${showEmpty ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
                        <FontAwesomeIcon icon={showEmpty ? faEye : faEyeSlash} /> 
                        {showEmpty ? 'Ocultando Vazios' : 'Mostrando Tudo'}
                    </button>
                </div>
            </div>

            {/* Lista com Scroll */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-gray-50">
                {isFetching ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-50">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-xl" />
                        <span className="text-[10px] uppercase font-bold text-gray-400">Carregando dados...</span>
                    </div>
                ) : renderProperties()}
            </div>
        </div>
    );
}