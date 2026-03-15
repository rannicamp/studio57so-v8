import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export function useBimViewer() {
    const [viewerInstance, setViewerInstance] = useState(null);
    const [selectedElements, setSelectedElements] = useState([]); 
    const [fastSelectionCount, setFastSelectionCount] = useState(0); 
    const [activeFile, setActiveFile] = useState(null);
    const [activeUrn, setActiveUrn] = useState(null);
    
    // Ref para evitar loops
    const isProcessingSelection = useRef(false);

    useEffect(() => {
        if (!viewerInstance) return;

        const onAggregateSelection = async (event) => {
            if (isProcessingSelection.current) return;
            
            try {
                // Pega a seleção de TODOS os modelos carregados
                const aggregateList = viewerInstance.getAggregateSelection();
                
                // Conta quantos itens no total
                const totalCount = aggregateList.reduce((acc, curr) => acc + curr.selection.length, 0);
                setFastSelectionCount(totalCount);

                // Se limpou a seleção, zera tudo
                if (totalCount === 0) {
                    setSelectedElements([]);
                    return;
                }

                isProcessingSelection.current = true;
                console.log(`🕵️ Devonildo Processando ${totalCount} itens...`);

                const promises = aggregateList.map(item => {
                    return new Promise((resolve) => {
                        // Tenta pegar o ID do projeto que anexamos no carregamento (useBimModels)
                        // Se não tiver, usa 'N/A'
                        const projetoBimId = item.model.studio57_context?.id || 'N/A';
                        const modelName = item.model.studio57_context?.nome || 'Modelo';

                        item.model.getBulkProperties(item.selection, ['externalId', 'Family', 'Família', 'Type', 'Tipo', 'name'], (props) => {
                            const data = props.map(p => {
                                let familia = '';
                                let tipo = '';
                                
                                if (p.properties) {
                                    p.properties.forEach(prop => {
                                        const nomeDisplay = prop.displayName || '';
                                        const nomeAtributo = prop.attributeName || '';
                                        if (nomeAtributo === 'Family' || nomeDisplay === 'Família') familia = prop.displayValue || prop.value;
                                        if (nomeAtributo === 'Type' || nomeDisplay === 'Tipo') tipo = prop.displayValue || prop.value;
                                    });
                                }
                                
                                // Fallback inteligente caso Família falhe
                                if (!familia && p.name) {
                                    const nomeItem = String(p.name);
                                    familia = nomeItem.includes('[') ? nomeItem.split('[')[0].trim() : nomeItem.trim();
                                }

                                return {
                                    externalId: p.externalId,
                                    projetoBimId: projetoBimId,
                                    modelName: modelName,
                                    familia: familia || 'Desconhecido',
                                    tipo: tipo || '-'
                                };
                            });
                            resolve(data);
                        }, (err) => {
                            console.error("Erro ao ler propriedades:", err);
                            resolve([]);
                        });
                    });
                });

                // Espera todos os modelos responderem e junta as listas
                const results = await Promise.all(promises);
                let allData = results.flat(); // Junta [[{obj1}], [{obj2}]] em [{obj1}, {obj2}]

                // BUSCA METADADOS REAIS (LIMPOS PELO EXTRATOR) NO SUPABASE
                if (allData.length > 0) {
                    try {
                        const supabase = createClient();
                        const externalIds = allData.map(item => item.externalId);
                        
                        const { data: dbData, error } = await supabase
                            .from('elementos_bim')
                            .select('external_id, familia, tipo')
                            .in('external_id', externalIds);

                        if (error) {
                            console.error("Supabase Error Enriching:", error);
                            toast.error("Erro RLS ao buscar Família do BD.");
                        } else if (!dbData || dbData.length === 0) {
                            toast.warning("As IDs clicadas no visualizador não batem com o banco.");
                        } else {
                            const dbMap = new Map();
                            dbData.forEach(el => dbMap.set(el.external_id, el));

                            // Mescla o dado oficial do banco na lista final
                            allData = allData.map(item => {
                                const bdItem = dbMap.get(item.externalId);
                                if (bdItem) {
                                    return {
                                        ...item,
                                        familia: bdItem.familia ? bdItem.familia : (item.familia !== 'Desconhecido' ? item.familia : 'S/ Família no BD'),
                                        tipo: bdItem.tipo ? bdItem.tipo : item.tipo
                                    };
                                }
                                return item;
                            });
                        }
                    } catch (dbErr) {
                        console.error("Aviso: Falha ao enriquecer dados com Supabase", dbErr);
                        toast.error("Falha fatal ao conectar no banco para ler propriedades.");
                    }
                }

                console.log("✅ Lista Final Enriquecida de Objetos:", allData);
                setSelectedElements(allData);

            } catch (error) {
                console.error("Erro crítico na seleção:", error);
            } finally {
                isProcessingSelection.current = false;
            }
        };

        viewerInstance.addEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
        
        return () => {
            if (viewerInstance) {
                viewerInstance.removeEventListener(window.Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, onAggregateSelection);
            }
        };
    }, [viewerInstance]);

    // Função auxiliar (mantém compatibilidade com botões antigos que esperam array de strings)
    const resolveSelection = (targetData, callback) => {
        if (!viewerInstance) {
            callback([targetData.externalId]);
            return;
        }
        if (selectedElements.length > 0) {
            // Mapeia de volta para apenas IDs se alguma função antiga pedir
            const idsOnly = selectedElements.map(el => el.externalId || el);
            callback(idsOnly);
        } else {
            callback([targetData.externalId]);
        }
    };

    return {
        viewerInstance,
        setViewerInstance,
        selectedElements,     
        setSelectedElements,
        fastSelectionCount,
        activeFile,
        activeUrn,
        resolveSelection
    };
}