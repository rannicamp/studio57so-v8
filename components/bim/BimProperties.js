'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faEye, faEyeSlash, faTag, faMousePointer, faDatabase } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useBimMapeamentos } from '../../hooks/bim/useBimMapeamentos';

export default function BimProperties({ selectedIds = [], elementExternalId, selectedCount, projetoBimId, urnAutodesk }) {
 const supabase = createClient();
 const queryClient = useQueryClient();
 const { organizacao_id } = useAuth();

 // Garante array de IDs
 const targetIds = useMemo(() => {
 if (selectedIds && selectedIds.length > 0) return selectedIds;
 if (elementExternalId) return [elementExternalId];
 return [];
 }, [selectedIds, elementExternalId]);

 const [showEmpty, setShowEmpty] = useState(false);
 const [editingKey, setEditingKey] = useState(null);
 const [tempValue, setTempValue] = useState('');

 // Mapeamentos BIM (Quantitativos) - Para mostrar tag 'vinculado'
 const { propriedadesMapeadas } = useBimMapeamentos({ organizacaoId: organizacao_id });

 // 1. BUSCA DE DADOS CONSOLIDADOS VIA RPC (No Backend)
 const { data: propriedadesConsolidadas, isFetching } = useQuery({
    queryKey: ['bimElementPropertiesConsolidated', targetIds, organizacao_id],
    queryFn: async () => {
      if (!targetIds || targetIds.length === 0) return null;
      if (!organizacao_id) return null;

      const { data, error } = await supabase.rpc('get_consolidated_element_properties', {
        p_organizacao_id: Number(organizacao_id),
        p_external_ids: targetIds.map(String)
      });

      if (error) {
        console.error('Erro ao chamar RPC get_consolidated_element_properties:', error);
        throw error;
      }
      return data || null;
    },
    enabled: targetIds.length > 0 && !!organizacao_id,
    staleTime: 1000 * 60 * 5,
  });

  // --- RENDERIZADORES ---
  const formatValue = (val) => {
    if (val === '__VARIES__') return <span className="italic text-gray-400 font-normal">&lt;Vários&gt;</span>;
    if (val === null || val === undefined) return "";
    const stringVal = String(val).trim();
    if (stringVal === "-" || stringVal === "" || stringVal.toLowerCase() === "null") return "";
    const num = parseFloat(stringVal);
    if (!isNaN(num) && isFinite(num)) {
      return Number.isInteger(num) ? num.toString() : num.toFixed(2);
    }
    return stringVal;
  };

  const autoSave = async (key, newValue) => {
    if (targetIds.length > 1) {
      toast.error("Edição de propriedades em massa não disponível (apenas Status).");
      setEditingKey(null);
      return;
    }

    try {
      const novasPropriedades = { ...(propriedadesConsolidadas?.propriedades || {}), [key]: newValue };
      
      const { error } = await supabase
        .from('elementos_bim')
        .update({ 
          propriedades: novasPropriedades, 
          atualizado_em: new Date() 
        })
        .eq('organizacao_id', organizacao_id)
        .eq('external_id', targetIds[0]);

      if (error) throw error;
      
      toast.success(`Salvo!`);
      queryClient.invalidateQueries({ queryKey: ['bimElementPropertiesConsolidated'] });
    } catch (error) { 
      toast.error("Erro ao salvar."); 
      console.error(error);
    } finally { 
      setEditingKey(null); 
    }
  };

  const props = propriedadesConsolidadas?.propriedades || {};


 const getDestaqueValue = (colName, jsonNames) => {
 if (!propriedadesConsolidadas) return '...';
 if (propriedadesConsolidadas[colName] && propriedadesConsolidadas[colName] !== "") {
 return formatValue(propriedadesConsolidadas[colName]);
 }
 const jsonKey = Object.keys(props).find(k => jsonNames.some(n => k.toLowerCase().includes(n.toLowerCase())));
 return props[jsonKey] ? formatValue(props[jsonKey]) : '--';
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
 if (value === '__VARIES__' && !showEmpty) return null;
 const formatted = formatValue(value);
 if (!showEmpty && (formatted === "" || formatted === null || formatted === "--" || formatted === "0" || formatted === "0.00" || formatted === "0,00")) return null;
 const keysDestaque = ['família', 'family', 'tipo', 'type name', 'área', 'area', 'volume', 'comprimento', 'length', 'categoria', 'category', 'status_execucao'];
 if (keysDestaque.some(kd => key.toLowerCase().includes(kd))) return null;
 const isEditing = editingKey === key;
 const jaMapeada = propriedadesMapeadas?.has(key);

 return (
 <div key={key} className={`group p-2 rounded-lg border transition-all ${isEditing ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
 <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5 truncate flex justify-between items-center" title={key}>
 <span>{key}</span>
 {jaMapeada && (
 <span className="text-[8px] bg-green-100 text-green-700 border border-green-200 px-1 py-0.5 rounded-sm font-bold lowercase tracking-normal ml-2 shrink-0">vinculado</span>
 )}
 </p>
 <div className="relative">
 {isEditing ? (
 <input autoFocus value={tempValue} onChange={(e) => setTempValue(e.target.value)} onBlur={() => autoSave(key, tempValue)} className="w-full text-xs font-bold text-blue-900 bg-white border border-blue-200 rounded px-1 outline-none" />
 ) : (
 <p className={`text-xs font-medium cursor-text truncate pr-4 ${value === '__VARIES__' ? 'text-gray-400 italic' : 'text-gray-700'}`} onClick={() => { if(targetIds.length === 1) { setEditingKey(key); setTempValue(value); } }}>
 {formatted || '-'}
 </p>
 )}
 </div>
 </div>
 );
 };

 if (isFetching) return <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2 opacity-50"><FontAwesomeIcon icon={faSpinner} spin size="2x" /><span className="text-xs font-bold uppercase">Carregando...</span></div>;

 if (!propriedadesConsolidadas) return <div className="p-4 text-center text-gray-400 text-xs">Dados não sincronizados.</div>;

 return (
 <div className="h-full flex flex-col bg-gray-50">
 {/* 1. HEADER & STATUS */}
 <div className="p-4 bg-white border-b border-gray-100 shadow-sm">
 {/* Contador */}
 {selectedCount > 0 && (
 <div className="flex items-center gap-1.5 mb-2">
 <span className="bg-blue-50 text-blue-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1">
 <FontAwesomeIcon icon={faMousePointer} className="text-[8px]" />
 {selectedCount} {selectedCount === 1 ? 'ITEM' : 'ITENS'}
 </span>
 </div>
 )}

 {/* Identificação */}
 <h3 className="text-[13px] font-black text-gray-900 leading-tight uppercase italic truncate">{destaques.familia}</h3>
 <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter truncate mb-3">{destaques.tipo}</p>

 {/* Quantitativos Rápidos */}
 <div className="grid grid-cols-3 gap-2 py-2 border-t border-gray-50 mt-1">
 <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100"><p className="text-[8px] font-black text-gray-400 uppercase">Área</p><p className="text-[11px] font-bold text-gray-700">{destaques.area}</p></div>
 <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100"><p className="text-[8px] font-black text-gray-400 uppercase">Volume</p><p className="text-[11px] font-bold text-gray-700">{destaques.volume}</p></div>
 <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100"><p className="text-[8px] font-black text-gray-400 uppercase">Comp.</p><p className="text-[11px] font-bold text-gray-700">{destaques.comprimento}</p></div>
 </div>
 </div>

 {/* LISTA DE PROPRIEDADES JSON */}
 <div className="px-4 py-1.5 flex justify-between items-center bg-gray-50 border-b border-gray-100">
 <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Detalhes Técnicos</span>
 <button onClick={() => setShowEmpty(!showEmpty)} className={`text-[9px] font-bold flex items-center gap-1 px-2 py-1 rounded-full transition-all ${showEmpty ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-500'}`}><FontAwesomeIcon icon={showEmpty ? faEye : faEyeSlash} /> {showEmpty ? 'TUDO' : 'RELEVANTES'}</button>
 </div>
 <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
 {Object.entries(props).map(([k, v]) => renderPropertyCard(k, v))}
 </div>
 </div>
 );
}