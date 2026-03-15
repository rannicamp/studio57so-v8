// Caminho: utils/bim/bim-extractor.js
import { createClient } from '../supabase/client';

const supabase = createClient();

/**
 * EXTRATOR STUDIO 57 - VERSÃO FINAL (RPC + EXTRAÇÃO ROBUSTA)
 * 1. Extrai dados do Viewer com tratamento de falhas.
 * 2. Limpa propriedades vazias.
 * 3. Envia PACOTE ÚNICO para o Banco realizar a Sincronização Inteligente (Upsert + Soft Delete).
 */
export async function extrairDadosDoModelo(viewer, projetoBimId, organizacaoId, onProgress) {
    // --- 1. VALIDAÇÃO E PREPARAÇÃO ---
    if (!viewer) throw new Error("Viewer não encontrado.");
    const model = viewer.model ? viewer.model : viewer;
    if (!model || !model.getData) throw new Error("Modelo não carregado corretamente.");

    // Captura URN Limpa
    const rawUrn = model.getData().urn;
    const cleanUrn = rawUrn ? (rawUrn.startsWith('urn:') ? rawUrn.replace('urn:', '') : rawUrn) : null;
    console.log(`[Elo 57] Iniciando extração. URN: ${cleanUrn}`);

    const tree = model.getInstanceTree();
    if (!tree) throw new Error("Árvore do modelo ainda não carregada.");

    // --- 2. COLETA DE IDs (FOLHAS) ---
    const leafIds = [];
    tree.enumNodeChildren(tree.getRootId(), (dbId) => {
        if (tree.getChildCount(dbId) === 0) {
            leafIds.push(dbId);
        }
    }, true);

    const totalItems = leafIds.length;
    if (totalItems === 0) throw new Error("Nenhum elemento encontrado no modelo 3D.");

    // --- 3. EXTRAÇÃO E ENVIO (CHUNKING) ---
    // Extrai no Viewer e ENVIA IMEDIATAMENTE pro banco em lotes para poupar memória e payload.
    let processed = 0;
    const CHUNK_SIZE = 1000; 
    const syncSession = new Date().toISOString(); // Assinatura de tempo para o Soft-Delete seguro

    // Função auxiliar para ler propriedades promisified
    const getPropsPromise = (ids) => {
        return new Promise((resolve) => {
            model.getBulkProperties(ids, {}, (results) => resolve(results), (err) => {
                console.error("Erro leitura Autodesk:", err);
                resolve([]); // Retorna vazio para não quebrar fluxo
            });
        });
    };

    console.log(`[Elo 57] Iniciando extração de ${totalItems} elementos em lotes de ${CHUNK_SIZE}...`);

    for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
        const chunkIds = leafIds.slice(i, i + CHUNK_SIZE);

        // Lê do Viewer
        const rawResults = await getPropsPromise(chunkIds);

        // Processa e Limpa os Dados
        const processedChunk = rawResults.map(item => {
            const propsObj = {};
            let categoria = '';
            let familia = '';
            let tipo = '';
            let nivel = '';

            // Garante External ID
            const externalId = item.externalId || `ext-${item.dbId}`;

            if (item.properties) {
                item.properties.forEach(p => {
                    let val = p.displayValue;
                    if (val === "" || val === null || val === undefined) {
                        val = p.value;
                    }

                    if (val !== "" && val !== null && val !== undefined) {
                        // Limpa chaves para JSONB de forma segura (Tolerância MEP)
                        const rawName = String(p.displayName || p.attributeName || p.name || `Propriedade_${p.dbId || 'Desconhecida'}`);
                        const safeKey = rawName.replace(/[".]/g, '');
                        propsObj[safeKey] = val;
                        
                        // Mapeamento Inteligente com travamento (só pega se ainda não tiver pego ou se for uma chave muito forte)
                        const nameLower = rawName.toLowerCase();
                        
                        if (!categoria && (nameLower === 'category' || nameLower === 'categoria')) categoria = val;
                        if (!familia && (nameLower === 'family' || nameLower === 'família')) familia = val;
                        // Para Tipo, Revit usa "Type Name", "Nome do tipo", "Type", "Tipo"
                        if (!tipo && (nameLower === 'type name' || nameLower === 'nome do tipo' || nameLower === 'type' || nameLower === 'tipo')) tipo = val;
                        if (!nivel && (nameLower.includes('level') || nameLower.includes('nível') || nameLower.includes('nivel'))) nivel = val;
                    }
                });
            }

            // Fallback para Família (usa o nome do item se falhar) de forma segura
            if (!familia && item.name) {
                const nomeItem = String(item.name);
                familia = nomeItem.includes('[') ? nomeItem.split('[')[0].trim() : nomeItem.trim();
            }

            // Fallback para Tipo (usa o nome do item se falhar)
            if (!tipo && item.name) {
                const nomeItem = String(item.name);
                // Muitas vezes o item name é "Familia [Tipo]". Vamos tentar extrair.
                if (nomeItem.includes('[') && nomeItem.includes(']')) {
                    tipo = nomeItem.substring(nomeItem.indexOf('[') + 1, nomeItem.indexOf(']')).trim();
                } else {
                    tipo = nomeItem.trim();
                }
            }

            return {
                external_id: externalId,
                categoria: categoria || 'Outros (Instalações)',
                familia: familia || 'Desconhecido',
                tipo: tipo || 'Elemento MEP',
                nivel: nivel || 'Não definido',
                propriedades: propsObj
            };
        });

        // ENVIA ESTE LOTE PARA O BANCO IMEDIATAMENTE
        if (processedChunk.length > 0) {
            try {
                const { error: chunkError } = await supabase.rpc('sync_bim_elements_chunk', {
                    p_organizacao_id: organizacaoId,
                    p_projeto_id: projetoBimId,
                    p_urn: cleanUrn,
                    p_sync_session: syncSession,
                    p_elementos: processedChunk
                });

                if (chunkError) {
                    console.error(`[Elo 57] Erro na RPC sinc. Lote ${i/CHUNK_SIZE}:`, chunkError);
                    throw new Error("Falha Supabase ao salvar lote: " + chunkError.message);
                }
            } catch (err) {
                 console.error(`[Elo 57] Falha fatal no chunk de extração. O chunk continha ${processedChunk.length} peças. Erro:`, err);
                 throw err;
            }
        }

        processed += chunkIds.length;
        // Notifica progresso da extração (0 a 90% do processo total)
        if (onProgress) onProgress(Math.round((processed / totalItems) * 90));
    }

    // --- 4. FINALIZAÇÃO E SOFT DELETE (RPC) ---
    console.log(`[Elo 57] Todos os lotes enviados. Finalizando sincronização...`);
    if (onProgress) onProgress(95); 

    const { error: finalizeError } = await supabase.rpc('sync_bim_elements_finalize', {
        p_projeto_id: projetoBimId,
        p_sync_session: syncSession
    });

    if (finalizeError) {
        console.error("Erro na RPC de finalização:", finalizeError);
        throw new Error("Erro ao finalizar a extração no banco: " + finalizeError.message);
    }

    if (onProgress) onProgress(100);
    console.log("[Elo 57] Sincronização e Soft Delete concluídos com sucesso (Chunking).");

    return true;
}