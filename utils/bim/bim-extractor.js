// Caminho: utils/bim/bim-extractor.js
import { createClient } from '../supabase/client';

const supabase = createClient();

/**
 * EXTRATOR STUDIO 57 - VERSÃO FINAL (RPC + EXTRAÇÃO ROBUSTA + DELTAS BIM 2.0)
 * 1. Busca os elementos da versão anterior para fins de comparação.
 * 2. Extrai dados do Viewer com tratamento de falhas.
 * 3. Envia PACOTE ÚNICO para o Banco realizar a Sincronização Inteligente (Upsert + Soft Delete).
 * 4. Calcula e insere os Deltas (adicionados, removidos, alterados) no histórico.
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

    // Captura estado anterior dos elementos para cálculo do Delta (BIM 2.0)
    console.log(`[Elo 57] Capturando estado anterior dos elementos para cálculo de deltas...`);
    let elementosAnteriores = [];
    try {
        const { data, error: fetchPrevError } = await supabase
            .from('elementos_bim')
            .select('external_id, categoria, familia, tipo, propriedades')
            .eq('projeto_bim_id', projetoBimId)
            .eq('is_active', true);

        if (fetchPrevError) {
            console.warn("[Elo 57] Não foi possível carregar elementos anteriores:", fetchPrevError.message);
        } else {
            elementosAnteriores = data || [];
            console.log(`[Elo 57] Encontrados ${elementosAnteriores.length} elementos na versão anterior.`);
        }
    } catch (err) {
        console.warn("[Elo 57] Erro ao buscar elementos anteriores para comparação:", err);
    }

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
    let processed = 0;
    const CHUNK_SIZE = 1000; 
    const syncSession = new Date().toISOString(); // Assinatura de tempo para o Soft-Delete seguro
    let todosElementosNovos = []; // Acumulador para cálculo do Delta no final

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
                        const rawName = String(p.displayName || p.attributeName || p.name || `Propriedade_${p.dbId || 'Desconhecida'}`);
                        const safeKey = rawName.replace(/[".]/g, '');
                        propsObj[safeKey] = val;
                        
                        const nameLower = rawName.toLowerCase();
                        
                        if (!categoria && (nameLower === 'category' || nameLower === 'categoria')) categoria = val;
                        if (!familia && (nameLower === 'family' || nameLower === 'família')) familia = val;
                        if (!tipo && (nameLower === 'type name' || nameLower === 'nome do tipo' || nameLower === 'type' || nameLower === 'tipo')) tipo = val;
                        if (!nivel && (nameLower.includes('level') || nameLower.includes('nível') || nameLower.includes('nivel'))) nivel = val;
                    }
                });
            }

            if (!familia && item.name) {
                const nomeItem = String(item.name);
                familia = nomeItem.includes('[') ? nomeItem.split('[')[0].trim() : nomeItem.trim();
            }

            if (!tipo && item.name) {
                const nomeItem = String(item.name);
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

        // Acumula os novos elementos na memória para calcular o delta
        todosElementosNovos = todosElementosNovos.concat(processedChunk);

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
                 console.error(`[Elo 57] Falha fatal no chunk de extração. Erro:`, err);
                 throw err;
            }
        }

        processed += chunkIds.length;
        if (onProgress) onProgress(Math.round((processed / totalItems) * 80));
    }

    // --- 4. FINALIZAÇÃO E SOFT DELETE (RPC) ---
    console.log(`[Elo 57] Todos os lotes enviados. Finalizando sincronização...`);
    if (onProgress) onProgress(85); 

    const { error: finalizeError } = await supabase.rpc('sync_bim_elements_finalize', {
        p_projeto_id: projetoBimId,
        p_sync_session: syncSession
    });

    if (finalizeError) {
        console.error("Erro na RPC de finalização:", finalizeError);
        throw new Error("Erro ao finalizar a extração no banco: " + finalizeError.message);
    }

    if (onProgress) onProgress(90);

    // --- 5. COMPARAÇÃO E GRAVAÇÃO DE DELTAS (BIM 2.0) ---
    if (elementosAnteriores.length > 0 && todosElementosNovos.length > 0) {
        console.log(`[Elo 57] Iniciando cálculo de deltas entre as versões...`);
        try {
            const mapAnterior = new Map(elementosAnteriores.map(e => [e.external_id, e]));
            const mapNovo = new Map(todosElementosNovos.map(e => [e.external_id, e]));
            const deltas = [];

            // Identificar Adicionados e Modificados
            for (const [extId, elNovo] of mapNovo.entries()) {
                const elAntigo = mapAnterior.get(extId);
                if (!elAntigo) {
                    // Adicionado
                    deltas.push({
                        external_id: extId,
                        categoria: elNovo.categoria,
                        familia: elNovo.familia,
                        tipo: elNovo.tipo,
                        acao: 'adicionado'
                    });
                } else {
                    // Existe em ambos, verificar se propriedades de quantitativos mudaram
                    const propChaves = ['Volume', 'Área', 'Area', 'Comprimento', 'Length', 'Volume de concreto', 'Espessura', 'Thickness'];
                    let propAlterada = null;
                    let valAnterior = null;
                    let valNovo = null;

                    for (const chave of propChaves) {
                        const vAnt = elAntigo.propriedades?.[chave];
                        const vNov = elNovo.propriedades?.[chave];
                        if (vAnt !== vNov && vNov !== undefined) {
                            propAlterada = chave;
                            valAnterior = vAnt;
                            valNovo = vNov;
                            break; 
                        }
                    }

                    if (propAlterada) {
                        deltas.push({
                            external_id: extId,
                            categoria: elNovo.categoria,
                            familia: elNovo.familia,
                            tipo: elNovo.tipo,
                            acao: 'modificado',
                            propriedade_alterada: propAlterada,
                            valor_anterior: valAnterior,
                            valor_novo: valNovo
                        });
                    }
                }
            }

            // Identificar Removidos
            for (const [extId, elAntigo] of mapAnterior.entries()) {
                if (!mapNovo.has(extId)) {
                    deltas.push({
                        external_id: extId,
                        categoria: elAntigo.categoria,
                        familia: elAntigo.familia,
                        tipo: elAntigo.tipo,
                        acao: 'removido'
                    });
                }
            }

            if (deltas.length > 0) {
                console.log(`[Elo 57] Enviando ${deltas.length} deltas de elementos para a API de comparação...`);
                
                const { data: proj } = await supabase
                    .from('projetos_bim')
                    .select('versao')
                    .eq('id', projetoBimId)
                    .single();
                
                const versaoNova = proj ? proj.versao : 1;
                const versaoAnterior = versaoNova > 1 ? versaoNova - 1 : null;

                const compareRes = await fetch('/api/aps/compare', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projetoBimId,
                        versaoAnterior,
                        versaoNova,
                        organizacaoId,
                        deltas
                    })
                });

                if (!compareRes.ok) {
                    const txt = await compareRes.text();
                    console.warn('[Elo 57] Erro ao gravar deltas de comparação:', txt);
                } else {
                    console.log(`[Elo 57] Histórico de deltas de versão gravado com sucesso.`);
                }
            } else {
                console.log("[Elo 57] Nenhuma mudança de elementos detectada nesta versão.");
            }
        } catch (compareErr) {
            console.error("[Elo 57] Falha no processo de cálculo de deltas:", compareErr);
        }
    }

    if (onProgress) onProgress(100);
    console.log("[Elo 57] Sincronização e Auditoria de Deltas concluídas com sucesso (Chunking).");

    return true;
}