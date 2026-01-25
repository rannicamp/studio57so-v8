// Caminho: utils/bim/bim-extractor.js
import { createClient } from '../supabase/client'; 

const supabase = createClient();

/**
 * EXTRATOR STUDIO 57 - VERSÃO VISTA FEDERADA (URN DNA)
 * Extrai propriedades e vincula diretamente à URN do arquivo.
 */
export async function extrairDadosDoModelo(viewer, projetoBimId, organizacaoId, onProgress) {
    if (!viewer || !viewer.model) throw new Error("Modelo não carregado no visualizador.");

    const model = viewer.model;
    
    // Capturamos a URN "limpa" para carimbar nos elementos
    const rawUrn = model.getData()?.urn;
    const cleanUrn = rawUrn?.startsWith('urn:') ? rawUrn.replace('urn:', '') : rawUrn;

    if (!cleanUrn) throw new Error("Não foi possível identificar a URN do modelo.");

    const tree = model.getInstanceTree();
    if (!tree) throw new Error("Árvore do modelo ainda não carregada. Aguarde o processamento total.");

    const leafIds = [];

    // 1. Coletar IDs dos elementos reais (folhas da árvore)
    tree.enumNodeChildren(tree.getRootId(), (dbId) => {
        if (tree.getChildCount(dbId) === 0) {
            leafIds.push(dbId);
        }
    }, true);

    const totalItems = leafIds.length;
    if (totalItems === 0) throw new Error("Nenhum elemento encontrado no modelo.");

    let processed = 0;
    const CHUNK_SIZE = 100; // Processamos em blocos para não travar o navegador
    
    for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
        const chunkIds = leafIds.slice(i, i + CHUNK_SIZE);
        
        const dbRows = await new Promise((resolve) => {
            model.getBulkProperties(chunkIds, {}, (results) => {
                const rows = results.map(item => {
                    const propsObj = {};
                    let categoria = 'Outros';
                    let familia = '';
                    let tipo = '';
                    let nivel = 'Não definido';
                    
                    // Identificador único do Revit/Navisworks
                    const externalId = item.externalId || `ext-${item.dbId}`;

                    // Mapeamento de Propriedades Nativo
                    item.properties.forEach(p => {
                        propsObj[p.displayName] = p.displayValue;
                        
                        // Captura categorias e níveis (padrão Autodesk)
                        if (p.attributeName === 'Category') categoria = p.displayValue;
                        if (p.attributeName === 'Family' || p.displayName === 'Família') familia = p.displayValue;
                        if (p.attributeName === 'Type' || p.displayName === 'Tipo') tipo = p.displayValue;
                        if (p.attributeName === 'Level' || p.displayName === 'Nível') nivel = p.displayValue;
                    });

                    // Fallback para família se não encontrado nas props
                    if (!familia && item.name) familia = item.name.split('[')[0].trim();

                    return {
                        organizacao_id: organizacaoId,
                        projeto_bim_id: projetoBimId,
                        urn_autodesk: cleanUrn, // <--- O DNA DO MODELO AQUI!
                        external_id: externalId,
                        categoria: categoria,
                        familia: familia,
                        tipo: tipo,
                        nivel: nivel,
                        propriedades: propsObj,
                        status_execucao: 'nao_iniciado',
                        criado_em: new Date(),
                        atualizado_em: new Date()
                    };
                });
                resolve(rows);
            });
        });

        if (dbRows.length > 0) {
            // Upsert Inteligente: Se mudar a versão (URN), ele cria novos elementos.
            // Se for o mesmo projeto e ID, ele apenas atualiza as propriedades.
            const { error: upsertError } = await supabase
                .from('elementos_bim')
                .upsert(dbRows, { 
                    onConflict: 'projeto_bim_id, external_id' 
                });

            if (upsertError) {
                console.error("[STUDIO 57 ERROR]", upsertError);
                throw new Error(`Erro ao salvar no banco: ${upsertError.message}`);
            }
        }

        processed += chunkIds.length;
        if (onProgress) onProgress(Math.round((processed / totalItems) * 100));
    }

    return true;
}