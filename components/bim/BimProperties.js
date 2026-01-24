// Caminho: components/bim/BimProperties.js
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle, faTableList, faTags, faLayersGroup, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';

export default function BimProperties({ elementExternalId, projetoBimId, onClose }) {
    const supabase = createClient();

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
            
            if (error) return null;
            return data;
        },
        enabled: !!elementExternalId,
    });

    if (!elementExternalId) return null;

    return (
        <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-2xl animate-fade-in-right z-30">
            {/* Header */}
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                    <FontAwesomeIcon icon={faInfoCircle} className="text-blue-500" />
                    Propriedades do Elemento
                </h3>
                <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                    <FontAwesomeIcon icon={faTimes} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <div className="p-10 text-center text-blue-500">
                        <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                    </div>
                ) : elemento ? (
                    <div className="p-4 space-y-6">
                        {/* Resumo Principal */}
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                            <p className="text-[10px] font-bold text-blue-400 uppercase">Categoria</p>
                            <p className="text-sm font-black text-blue-900 mb-2">{elemento.categoria}</p>
                            <p className="text-[10px] font-bold text-blue-400 uppercase">Tipo</p>
                            <p className="text-xs font-medium text-blue-800">{elemento.tipo}</p>
                        </div>

                        {/* Lista de Propriedades (JSONB) */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <FontAwesomeIcon icon={faTableList} /> Dados Técnicos
                            </h4>
                            <div className="grid gap-2">
                                {Object.entries(elemento.propriedades || {}).map(([key, value]) => (
                                    <div key={key} className="bg-gray-50 p-2 rounded border border-gray-100 group hover:border-blue-200 transition-colors">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase group-hover:text-blue-400">{key}</p>
                                        <p className="text-xs text-gray-700 font-medium break-words">{String(value)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-10 text-center text-gray-400">
                        <p className="text-xs italic">Nenhum dado encontrado para este elemento no banco de dados.</p>
                    </div>
                )}
            </div>
        </div>
    );
}