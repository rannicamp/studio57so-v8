// Caminho: utils/bim/bim-extractor.js
import { createClient } from '../supabase/client'; 

const supabase = createClient();

/**
 * EXTRATOR STUDIO 57 - VERSÃO CORRIGIDA E ESTÁVEL
 * Recupera TODAS as propriedades (filtro {}) e vincula a URN correta.
 */
export async function extrairDadosDoModelo(viewer, projetoBimId, organizacaoId, onProgress) {
    // Validação inicial
    if (!viewer) throw new Error("Viewer não encontrado.");
    
    // Suporte para quando passamos o MODELO direto ou a instância do VIEWER
    const model = viewer.model ? viewer.model : viewer;
    
    if (!model || !model.getData) throw new Error("Modelo não carregado corretamente.");

    // --- 1. CAPTURA A URN (DNA DO ARQUIVO) ---
    // Isso é vital para o BIM Manager saber separar os elementos na vista federada
    const rawUrn = model.getData().urn;
    const cleanUrn = rawUrn ? (rawUrn.startsWith('urn:') ? rawUrn.replace('urn:', '') : rawUrn) : null;

    console.log(`[Studio 57] Extraindo de: ${cleanUrn || 'Sem URN'}`);

    const tree = model.getInstanceTree();
    if (!tree) throw new Error("Árvore do modelo ainda não carregada.");

    const leafIds = [];

    // 2. Coletar IDs dos elementos reais (folhas)
    tree.enumNodeChildren(tree.getRootId(), (dbId) => {
        if (tree.getChildCount(dbId) === 0) {
            leafIds.push(dbId);
        }
    }, true);

    const totalItems = leafIds.length;
    if (totalItems === 0) throw new Error("Nenhum elemento encontrado.");

    let processed = 0;
    const CHUNK_SIZE = 200; // Aumentei um pouco para ser mais rápido
    
    for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
        const chunkIds = leafIds.slice(i, i + CHUNK_SIZE);
        
        const dbRows = await new Promise((resolve, reject) => {
            // --- O SEGREDO ESTÁ AQUI: {} ---
            // Usar {} significa "Traga TUDO". Não use filtros aqui.
            model.getBulkProperties(chunkIds, {}, (results) => {
                try {
                    const rows = results.map(item => {
                        const propsObj = {};
                        let categoria = 'Outros';
                        let familia = '';
                        let tipo = '';
                        let nivel = 'Não definido';
                        
                        const externalId = item.externalId || `ext-${item.dbId}`;

                        // Processamento das propriedades
                        if (item.properties) {
                            item.properties.forEach(p => {
                                // Lógica para não salvar valores vazios, mas aceitar 0
                                let val = p.displayValue;
                                if (val === "" || val === null || val === undefined) {
                                    val = p.value; // Tenta valor bruto
                                }

                                // Se tiver valor real, salva no JSON
                                if (val !== "" && val !== null && val !== undefined) {
                                    // Remove caracteres estranhos do nome da propriedade para não quebrar JSON
                                    const safeKey = p.displayName.replace(/[".]/g, '');
                                    propsObj[safeKey] = val;
                                }
                                
                                // Mapeamento Colunas Chave
                                if (p.attributeName === 'Category') categoria = p.displayValue;
                                if (p.attributeName === 'Family' || p.displayName === 'Família') familia = p.displayValue;
                                if (p.attributeName === 'Type' || p.displayName === 'Tipo') tipo = p.displayValue;
                                if (p.attributeName === 'Level' || p.displayName === 'Nível' || p.attributeName === 'Level') nivel = p.displayValue;
                            });
                        }

                        // Fallback Família
                        if ((!familia || familia === "") && item.name) {
                            familia = item.name.split('[')[0].trim();
                        }

                        return {
                            organizacao_id: organizacaoId,
                            projeto_bim_id: projetoBimId,
                            urn_autodesk: cleanUrn, // <--- O VÍNCULO IMPORTANTE
                            external_id: externalId,
                            categoria: categoria || 'Outros',
                            familia: familia,
                            tipo: tipo,
                            nivel: nivel,
                            propriedades: propsObj, // AGORA VAI CHEIO!
                            status_execucao: 'nao_iniciado',
                            atualizado_em: new Date()
                        };
                    });
                    resolve(rows);
                } catch (e) {
                    console.error("Erro processando lote:", e);
                    resolve([]); // Não quebra o loop se um lote falhar
                }
            }, (err) => {
                console.error("Erro API Autodesk:", err);
                resolve([]);
            });
        });

        if (dbRows.length > 0) {
            const { error: upsertError } = await supabase
                .from('elementos_bim')
                .upsert(dbRows, { 
                    onConflict: 'projeto_bim_id, external_id'
                });

            if (upsertError) {
                console.error("[STUDIO 57 ERROR]", upsertError);
                // Não paramos tudo por um erro de banco, apenas logamos
            }
        }

        processed += chunkIds.length;
        if (onProgress) onProgress(Math.round((processed / totalItems) * 100));
    }

    return true;
}