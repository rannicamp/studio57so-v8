const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    try {
        const data = JSON.parse(fs.readFileSync('C:/Users/Ranniere/.gemini/antigravity/brain/fa879587-5113-4f00-88e7-81c3259a9609/.system_generated/steps/1286/output.txt', 'utf8'));

        const match = data.result.match(/\[.*\]/s);
        if (!match) {
            console.error("JSON não encontrado.");
            return;
        }

        const records = JSON.parse(match[0]);
        console.log(`Iniciando atualização de ${records.length} registros...`);

        let updatedCount = 0;
        let errorCount = 0;

        // Processa em lotes para nao gargalar
        const CHUNK_SIZE = 50;
        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
            const chunk = records.slice(i, i + CHUNK_SIZE);
            const promises = chunk.map(async (r) => {
                let raw = r.old_desc;
                const empreendimento = r.empreendimento ? r.empreendimento.trim() : '';
                let unidades = r.unidades ? r.unidades.trim() : '';

                raw = raw.replace(/recebimento[^\w]*(-|:)?\s*/gi, '');
                if (empreendimento) {
                    const empRegex = new RegExp(`${empreendimento}[^\\w]*(-|:|\\|)?\\s*`, 'gi');
                    raw = raw.replace(empRegex, '');
                }
                raw = raw.replace(/(ap|lote)\s*\d+[^\w]*(-|:|\\|)?\s*/gi, '');
                raw = raw.replace(/contrato\s*#\d+\s*(\([^\)]+\))?[^\w]*(-|:|\|)?\s*/gi, '');
                raw = raw.replace(/\|\s*contrato\s*#\d+.*/gi, '');
                raw = raw.replace(/\([a-zA-ZÀ-ÿ\s]+\)/g, '');
                raw = raw.replace(/^[-:| ]+/, '').replace(/[-:| ]+$/, '').trim();

                if (!raw) raw = "Parcela";

                let unidadeStr = unidades;
                if (unidadeStr && !unidadeStr.toLowerCase().startsWith('ap') && !unidadeStr.toLowerCase().startsWith('lote')) {
                    const firstPart = unidadeStr.split(' ')[0];
                    if (/^\d+$/.test(firstPart)) {
                        unidadeStr = "AP " + unidadeStr;
                    }
                }

                const novaDesc = `${raw} - ${unidadeStr} | ${empreendimento}`;

                const { error } = await supabase
                    .from('lancamentos')
                    .update({ descricao: novaDesc })
                    .eq('id', r.id);

                if (error) {
                    console.error(`Erro ao atualizar ID ${r.id}:`, error.message);
                    errorCount++;
                } else {
                    updatedCount++;
                }
            });

            await Promise.all(promises);
            console.log(`Lote ${Math.floor(i / CHUNK_SIZE) + 1} processado. Sucesso: ${updatedCount}, Erros: ${errorCount}`);
        }

        console.log(`Pronto! Sucesso: ${updatedCount}, Erros: ${errorCount}`);
    } catch (e) {
        console.error("Erro fatal:", e);
    }
}

run();
