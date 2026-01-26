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
    console.log(`[Studio 57] Iniciando extração. URN: ${cleanUrn}`);

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

    // --- 3. EXTRAÇÃO EM MEMÓRIA (CHUNKING APENAS PARA LEITURA) ---
    // Precisamos ler em pedaços para não travar a UI do navegador, 
    // mas vamos guardar tudo em 'allElements' para enviar junto no final.
    let allElements = []; 
    let processed = 0;
    const CHUNK_SIZE = 1000; // Leitura mais agressiva pois é apenas memória local

    // Função auxiliar para ler propriedades promisified
    const getPropsPromise = (ids) => {
        return new Promise((resolve) => {
            model.getBulkProperties(ids, {}, (results) => resolve(results), (err) => {
                console.error("Erro leitura Autodesk:", err);
                resolve([]); // Retorna vazio para não quebrar fluxo
            });
        });
    };

    for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
        const chunkIds = leafIds.slice(i, i + CHUNK_SIZE);
        
        // Lê do Viewer
        const rawResults = await getPropsPromise(chunkIds);

        // Processa e Limpa os Dados (Sua lógica original preservada)
        const processedChunk = rawResults.map(item => {
            const propsObj = {};
            let categoria = 'Outros';
            let familia = '';
            let tipo = '';
            let nivel = 'Não definido';
            
            // Garante External ID
            const externalId = item.externalId || `ext-${item.dbId}`;

            if (item.properties) {
                item.properties.forEach(p => {
                    // Lógica de valor (aceita 0, rejeita string vazia/null)
                    let val = p.displayValue;
                    if (val === "" || val === null || val === undefined) {
                        val = p.value;
                    }

                    if (val !== "" && val !== null && val !== undefined) {
                        // Limpa chaves para JSONB
                        const safeKey = p.displayName.replace(/[".]/g, '');
                        propsObj[safeKey] = val;
                    }
                    
                    // Mapeamento Inteligente
                    if (p.attributeName === 'Category') categoria = p.displayValue;
                    if (p.attributeName === 'Family' || p.displayName === 'Família') familia = p.displayValue;
                    if (p.attributeName === 'Type' || p.displayName === 'Tipo') tipo = p.displayValue;
                    if (p.attributeName === 'Level' || p.displayName === 'Nível' || p.attributeName === 'Level') nivel = p.displayValue;
                });
            }

            // Fallback para Família (usa o nome do item se falhar)
            if ((!familia || familia === "") && item.name) {
                familia = item.name.split('[')[0].trim();
            }

            // Retorna objeto formatado para a RPC do Banco
            return {
                external_id: externalId,
                categoria: categoria || 'Outros',
                familia: familia,
                tipo: tipo,
                nivel: nivel,
                propriedades: propsObj // JSONB limpo
            };
        });

        allElements = [...allElements, ...processedChunk];
        
        processed += chunkIds.length;
        // Notifica progresso da extração (0 a 50% do processo total)
        if (onProgress) onProgress(Math.round((processed / totalItems) * 50));
    }

    // --- 4. ENVIO PARA O BANCO (RPC) ---
    console.log(`[Studio 57] Enviando ${allElements.length} elementos para sincronização no banco...`);
    if (onProgress) onProgress(75); // Pulou para envio

    const { error } = await supabase.rpc('sync_bim_elements', {
        p_organizacao_id: organizacaoId,
        p_projeto_id: projetoBimId,
        p_urn: cleanUrn,
        p_elementos: allElements // Envia o ARRAY GIGANTE de uma vez
    });

    if (error) {
        console.error("Erro na RPC sync_bim_elements:", error);
        throw new Error("Erro ao salvar dados no banco: " + error.message);
    }

    if (onProgress) onProgress(100);
    console.log("[Studio 57] Sincronização e Soft Delete concluídos com sucesso.");
    
    return true;
}