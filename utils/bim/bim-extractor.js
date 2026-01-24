// Caminho: utils/bim-extractor.js
import { createClient } from './supabase/client';

const supabase = createClient();

/**
 * Extrai todas as propriedades de todos os elementos do modelo e salva no Supabase.
 * @param {Object} viewer - A instância do Autodesk Viewer.
 * @param {Number|String} projetoBimId - O ID do projeto na tabela 'projetos_bim'.
 * @param {Number} organizacaoId - O ID da organização.
 * @param {Function} onProgress - Callback para atualizar a barra de progresso (0 a 100).
 */
export async function extrairDadosDoModelo(viewer, projetoBimId, organizacaoId, onProgress) {
    if (!viewer || !viewer.model) throw new Error("Modelo não carregado.");

    const model = viewer.model;
    const tree = model.getInstanceTree();
    const leafIds = [];

    // 1. Coletar apenas os "Nós Folha" (Elementos que têm geometria real)
    // Ignoramos nós de grupo/família para não duplicar dados.
    tree.enumNodeChildren(tree.getRootId(), (dbId) => {
        // Se não tiver filhos, é uma folha (elemento físico)
        if (tree.getChildCount(dbId) === 0) {
            leafIds.push(dbId);
        }
    }, true); // true = recursivo

    const totalItems = leafIds.length;
    let processed = 0;
    const CHUNK_SIZE = 500; // Processa de 500 em 500 para não travar a aba

    console.log(`[BIM MINER] Iniciando extração de ${totalItems} elementos...`);

    // 2. Processar em Lotes (Batching)
    for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
        const chunkIds = leafIds.slice(i, i + CHUNK_SIZE);
        
        // Pede ao Viewer as propriedades deste lote
        const properties = await new Promise((resolve, reject) => {
            model.getBulkProperties(chunkIds, null, resolve, reject);
        });

        // 3. Transformar dados para o formato do Supabase
        const dbRows = properties.map(propData => {
            // Encontra o ExternalId (Guid) e Nome
            const externalId = propData.externalId;
            const name = propData.name;
            
            // Transforma o array de props [{displayName: 'Area', displayValue: 10}] 
            // em um Objeto JSON limpo { Area: 10, Volume: 5 }
            const propsObj = {};
            let categoria = 'Indefinido';
            let familia = '';
            let tipo = '';
            let nivel = '';

            propData.properties.forEach(p => {
                // Remove caracteres estranhos das chaves para o JSONB
                const key = p.displayName.replace(/[.]/g, '_'); 
                propsObj[key] = p.displayValue;

                // Captura campos chaves para colunas específicas
                if (p.displayName === 'Categoria' || p.attributeName === 'Category') categoria = p.displayValue;
                if (p.displayName === 'Família' || p.attributeName === 'Family') familia = p.displayValue;
                if (p.displayName === 'Tipo' || p.attributeName === 'Type') tipo = p.displayValue;
                if (p.displayName === 'Nível' || p.attributeName === 'Level') nivel = p.displayValue;
            });

            return {
                organizacao_id: organizacaoId,
                projeto_bim_id: projetoBimId,
                external_id: externalId,
                categoria: categoria,
                familia: familia || name.split('[')[0].trim(), // Tenta extrair família do nome se vazio
                tipo: tipo,
                nivel: nivel,
                propriedades: propsObj, // O JSON completo
                status_execucao: 'nao_iniciado',
                updated_at: new Date()
            };
        });

        // 4. Enviar para o Supabase (Upsert = Inserir ou Atualizar se já existir)
        const { error } = await supabase
            .from('elementos_bim')
            .upsert(dbRows, { onConflict: 'projeto_bim_id, external_id' }); // Chave composta única

        if (error) {
            console.error(`Erro no lote ${i}:`, error);
            // Não paramos o processo, apenas logamos o erro do lote
        }

        processed += chunkIds.length;
        if (onProgress) onProgress(Math.round((processed / totalItems) * 100));
    }

    console.log("[BIM MINER] Extração concluída com sucesso!");
    return true;
}