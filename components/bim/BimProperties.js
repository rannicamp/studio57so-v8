'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faEye, faEyeSlash, faPencilAlt, faCube, faTag, faMousePointer 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimProperties({ elementExternalId, selectedCount, projetoBimId, urnAutodesk }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { organizacao_id } = useAuth();

    const [showEmpty, setShowEmpty] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [tempValue, setTempValue] = useState('');

    const { data: elemento, isFetching } = useQuery({
        queryKey: ['bimElementProperties', elementExternalId, urnAutodesk],
        queryFn: async () => {
            if (!elementExternalId) return null;
            const cleanUrn = urnAutodesk ? urnAutodesk.replace(/^urn:/, '').trim() : null;
            let query = supabase.from('elementos_bim').select('*').eq('external_id', elementExternalId);
            if (cleanUrn) query = query.eq('urn_autodesk', cleanUrn);
            else if (projetoBimId) query = query.eq('projeto_bim_id', projetoBimId);

            const { data, error } = await query.maybeSingle(); 
            if (error) throw error;
            return data || { external_id: elementExternalId, propriedades: {} };
        },
        enabled: !!elementExternalId,
    });

    const formatValue = (val) => {
        if (val === null || val === undefined) return "";
        const stringVal = String(val).trim();
        if (stringVal === "-" || stringVal === "" || stringVal.toLowerCase() === "null") return "";
        const num = parseFloat(stringVal);
        if (!isNaN(num) && isFinite(num)) {
            return Number(num.toFixed(2)).toString();
        }
        return stringVal;
    };

    const autoSave = async (key, newValue) => {
        if (elemento?.propriedades?.[key] === newValue) { setEditingKey(null); return; }
        try {
            const novasPropriedades = { ...(elemento?.propriedades || {}), [key]: newValue };
            await supabase.from('elementos_bim').upsert({ 
                organizacao_id, 
                projeto_bim_id: elemento.projeto_bim_id || projetoBimId, 
                urn_autodesk: urnAutodesk?.replace(/^urn:/, '').trim(), 
                external_id: elementExternalId,
                propriedades: novasPropriedades, 
                categoria: elemento?.categoria,
                familia: elemento?.familia,
                tipo: elemento?.tipo,
                atualizado_em: new Date() 
            }, { onConflict: 'projeto_bim_id, external_id' });
            toast.success(`Propriedade salva!`);
            queryClient.invalidateQueries(['bimElementProperties']);
        } catch (error) { toast.error("Erro ao salvar."); } finally { setEditingKey(null); }
    };

    const props = elemento?.propriedades || {};

    const getDestaqueValue = (colName, jsonNames) => {
        if (elemento && elemento[colName] && elemento[colName] !== "-" && elemento[colName] !== "") {
            return formatValue(elemento[colName]);
        }
        const jsonKey = Object.keys(props).find(k => jsonNames.some(n => k.toLowerCase().includes(n.toLowerCase())));
        return formatValue(props[jsonKey]);
    };

    const destaques = {
        categoria: getDestaqueValue('categoria', ['category', 'categoria']),
        familia: getDestaqueValue('familia', ['família', 'family']),
        tipo: getDestaqueValue('tipo', ['tipo', 'type name']),
        area: getDestaqueValue('', ['área', 'area']),
        volume: getDestaqueValue('', ['volume']),
        comprimento: getDestaqueValue('', ['comprimento', 'length', 'comp.'])
    };

    const renderPropertyCard = (key, value) => {
        const formatted = formatValue(value);
        if (!showEmpty && formatted === "") return null;
        const keysDestaque = ['família', 'family', 'tipo', 'type name', 'área', 'area', 'volume', 'comprimento', 'length', 'categoria', 'category'];
        if (keysDestaque.some(kd => key.toLowerCase().includes(kd))) return null;
        const isEditing = editingKey === key;

        return (
            <div key={key} className={`group p-2 rounded-lg border transition-all ${isEditing ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5 truncate">{key}</p>
                <div className="relative">
                    {isEditing ? (
                        <input autoFocus value={tempValue} onChange={(e) => setTempValue(e.target.value)} onBlur={() => autoSave(key, tempValue)} className="w-full text-xs font-bold text-blue-900 bg-white border border-blue-200 rounded px-1 outline-none" />
                    ) : (
                        <p className="text-xs text-gray-700 font-medium cursor-text truncate pr-4" onClick={() => { setEditingKey(key); setTempValue(value); }}>
                            {formatted || '-'}
                        </p>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* 1. HEADER COM O CONTADOR NOVO */}
            <div className="p-4 bg-white border-b border-gray-100 shadow-sm">
                <div className="flex flex-col gap-1 mb-3">
                    
                    {/* AQUI ESTÁ A NOVIDADE: Badge de Seleção */}
                    {selectedCount > 0 && (
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="bg-blue-50 text-blue-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1">
                                <FontAwesomeIcon icon={faMousePointer} className="text-[8px]" />
                                {selectedCount} {selectedCount === 1 ? 'SELECIONADO' : 'SELECIONADOS'}
                            </span>
                        </div>
                    )}

                    <h3 className="text-[13px] font-black text-gray-900 leading-tight uppercase italic truncate">
                        {destaques.familia || 'Elemento'}
                    </h3>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter truncate">
                        {destaques.tipo || 'Tipo Principal'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="bg-gray-100 text-gray-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter border border-gray-200">
                            <FontAwesomeIcon icon={faTag} className="mr-1" />
                            {destaques.categoria || 'Nativo'}
                        </span>
                    </div>
                </div>

                {/* 2. GRID QUANTITATIVOS  */}
                <div className="grid grid-cols-3 gap-2 py-2 border-t border-gray-50 mt-2">
                    <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                        <p className="text-[8px] font-black text-gray-400 uppercase">Área</p>
                        <p className="text-[11px] font-bold text-gray-700">{destaques.area || '--'}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                        <p className="text-[8px] font-black text-gray-400 uppercase">Volume</p>
                        <p className="text-[11px] font-bold text-gray-700">{destaques.volume || '--'}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                        <p className="text-[8px] font-black text-gray-400 uppercase">Comp.</p>
                        <p className="text-[11px] font-bold text-gray-700">{destaques.comprimento || '--'}</p>
                    </div>
                </div>
            </div>

            {/* 3. RESTANTE DOS METADADOS  */}
            <div className="px-4 py-1.5 flex justify-between items-center bg-gray-50 border-b border-gray-100">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Metadados</span>
                <button onClick={() => setShowEmpty(!showEmpty)} className={`text-[9px] font-bold flex items-center gap-1 px-2 py-1 rounded-full transition-all ${showEmpty ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-500'}`}>
                    <FontAwesomeIcon icon={showEmpty ? faEye : faEyeSlash} /> {showEmpty ? 'TUDO' : 'RELEVANTES'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                {isFetching ? (
                    <div className="flex justify-center py-10 opacity-30"><FontAwesomeIcon icon={faSpinner} spin size="lg" /></div>
                ) : (
                    Object.entries(props).map(([k, v]) => renderPropertyCard(k, v))
                )}
            </div>
        </div>
    );
}