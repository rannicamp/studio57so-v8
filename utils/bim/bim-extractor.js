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

    // --- 3. AGRUPAMENTO RÁPIDO POR CATEGORIA ---
    console.log(`[Elo 57] Agrupando ${totalItems} elementos por categoria no Viewer...`);
    if (onProgress) onProgress(5);

    // Função auxiliar para ler propriedades promisified
    const getPropsPromise = (ids) => {
        return new Promise((resolve) => {
            model.getBulkProperties(ids, {}, (results) => resolve(results), (err) => {
                console.error("Erro leitura Autodesk:", err);
                resolve([]); // Retorna vazio para não quebrar fluxo
            });
        });
    };

    // Busca apenas a propriedade de categoria para agrupar as folhas de forma rápida
    const catResults = await new Promise((resolve) => {
        model.getBulkProperties(leafIds, { propFilter: ['Category', 'Categoria'] }, (results) => resolve(results), (err) => {
            console.warn("Erro ao ler categorias das folhas:", err);
            resolve([]);
        });
    });

    // Mapeia dbId para sua respectiva categoria
    const dbIdsPorCategoria = {};
    const dbIdsSemCategoria = [];

    catResults.forEach(item => {
        let categoria = null;
        if (item.properties) {
            const pCat = item.properties.find(p => {
                const nameLower = (p.displayName || p.attributeName || p.name || '').toLowerCase();
                return nameLower === 'category' || nameLower === 'categoria';
            });
            if (pCat && pCat.displayValue) {
                categoria = String(pCat.displayValue).trim();
            }
        }
        
        if (categoria) {
            if (!dbIdsPorCategoria[categoria]) dbIdsPorCategoria[categoria] = [];
            dbIdsPorCategoria[categoria].push(item.dbId);
        } else {
            dbIdsSemCategoria.push(item.dbId);
        }
    });

    // Trata os dbIds que não vieram no getBulkProperties (fallbacks)
    const faltantes = leafIds.filter(id => {
        const jaMapeado = dbIdsSemCategoria.includes(id) || Object.values(dbIdsPorCategoria).some(list => list.includes(id));
        return !jaMapeado;
    });
    dbIdsSemCategoria.push(...faltantes);

    if (dbIdsSemCategoria.length > 0) {
        dbIdsPorCategoria['Outros (Instalações)'] = dbIdsSemCategoria;
    }

    const categoriasOrdenadas = Object.keys(dbIdsPorCategoria).sort();
    console.log(`[Elo 57] Elementos agrupados em ${categoriasOrdenadas.length} categorias para sincronização.`);

    // --- 4. EXTRAÇÃO E ENVIO SEQUENCIAL POR CATEGORIA (EVITA TIMEOUT) ---
    let processed = 0;
    const CHUNK_SIZE = 200; // Reduzido de 1000 para 200 para deixar o payload JSON bem pequeno e leve
    const syncSession = new Date().toISOString(); // Assinatura de tempo para o Soft-Delete seguro
    let todosElementosNovos = []; // Acumulador para cálculo do Delta no final

    for (let c = 0; c < categoriasOrdenadas.length; c++) {
        const categoriaNome = categoriasOrdenadas[c];
        const idsDaCategoria = dbIdsPorCategoria[categoriaNome];
        const totalCat = idsDaCategoria.length;

        console.log(`[Elo 57] Sincronizando categoria "${categoriaNome}" (${totalCat} elementos)...`);

        for (let i = 0; i < totalCat; i += CHUNK_SIZE) {
            const chunkIds = idsDaCategoria.slice(i, i + CHUNK_SIZE);

            if (onProgress) {
                // Atualiza o progresso entre 5% e 85% do processo total
                const percent = Math.round((processed / totalItems) * 80) + 5;
                onProgress(percent);
            }

            // Lê do Viewer
            const rawResults = await getPropsPromise(chunkIds);

            // Processa e Limpa os Dados
            const processedChunk = rawResults.map(item => {
                const propsObj = {};
                let categoria = categoriaNome; // Usa o nome da categoria agrupada por padrão
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
                            
                            if (nameLower === 'category' || nameLower === 'categoria') categoria = val;
                            if (nameLower === 'family' || nameLower === 'família') familia = val;
                            if (nameLower === 'type name' || nameLower === 'nome do tipo' || nameLower === 'type' || nameLower === 'tipo') tipo = val;
                            if (nameLower.includes('level') || nameLower.includes('nível') || nameLower.includes('nivel')) nivel = val;
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
                    categoria: categoria || categoriaNome,
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
                        console.error(`[Elo 57] Erro na RPC sinc. Categoria ${categoriaNome}, Lote ${i/CHUNK_SIZE}:`, chunkError);
                        throw new Error(`Falha Supabase ao salvar lote da categoria ${categoriaNome}: ` + chunkError.message);
                    }
                } catch (err) {
                     console.error(`[Elo 57] Falha fatal no chunk de extração. Erro:`, err);
                     throw err;
                }
            }

            processed += chunkIds.length;
        }
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