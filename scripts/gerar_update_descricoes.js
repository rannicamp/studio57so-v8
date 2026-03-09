const fs = require('fs');

const data = JSON.parse(fs.readFileSync('C:/Users/Ranniere/.gemini/antigravity/brain/fa879587-5113-4f00-88e7-81c3259a9609/.system_generated/steps/1286/output.txt', 'utf8'));

// O output do MCP retorna assim: {"result": "...\n\n<untrusted-data...>\n[...]\n..."}
// Precisamos extrair o JSON
const match = data.result.match(/\[.*\]/s);
if (!match) {
    console.error("JSON não encontrado na string de result.");
    process.exit(1);
}

const records = JSON.parse(match[0]);
let sql = "BEGIN;\n";

for (const r of records) {
    let raw = r.old_desc;
    const empreendimento = r.empreendimento ? r.empreendimento.trim() : '';
    const unidades = r.unidades ? r.unidades.trim() : '';

    // Remove padroes irrelevantes
    // Remove "RECEBIMENTO - " ou "Recebimento: "
    raw = raw.replace(/recebimento[^\w]*(-|:)?\s*/gi, '');

    // Remove nome do empreendimento (ex: "RESIDENCIAL ALFA - ")
    if (empreendimento) {
        const empRegex = new RegExp(`${empreendimento}[^\\w]*(-|:|\\|)?\\s*`, 'gi');
        raw = raw.replace(empRegex, '');
    }

    // Remove "AP 402" ou "LOTE 10" pois a unidade ja sera concatenada no final
    raw = raw.replace(/(ap|lote)\s*\d+[^\w]*(-|:|\\|)?\s*/gi, '');

    // Remove "Contrato #XX (Nome do Cliente)"
    raw = raw.replace(/contrato\s*#\d+\s*(\([^\)]+\))?[^\w]*(-|:|\|)?\s*/gi, '');
    // Remove algo como "| Contrato #12 ..."
    raw = raw.replace(/\|\s*contrato\s*#\d+.*/gi, '');
    // Remove parente do nome (ex: "(José)") se tiver sobrado
    raw = raw.replace(/\([a-zA-ZÀ-ÿ\s]+\)/g, '');

    // Limpa pontuacao que sobrou nos extremos
    raw = raw.replace(/^[-:| ]+/, '').replace(/[-:| ]+$/, '').trim();

    // Se sobrou vazio, coloca "Parcela"
    if (!raw) raw = "Parcela";

    // Formato final: [TIPO PARCELA] - [UNIDADE] | [EMPREENDIMENTO]
    // Tratando caso a unidade seja "402 e Garagem 05" queremos que fique "AP 402 e Garagem 05" se possivel, mas usar o que tem
    let unidadeStr = unidades;
    if (unidadeStr && !unidadeStr.toLowerCase().startsWith('ap') && !unidadeStr.toLowerCase().startsWith('lote')) {
        // Verifica se só tem numeros na primeira palavra pra chamar de AP
        const firstPart = unidadeStr.split(' ')[0];
        if (/^\d+$/.test(firstPart)) {
            unidadeStr = "AP " + unidadeStr;
        }
    }

    const novaDesc = `${raw} - ${unidadeStr} | ${empreendimento}`;

    // Escapa aspas simples
    const safeDesc = novaDesc.replace(/'/g, "''");

    sql += `UPDATE public.lancamentos SET descricao = '${safeDesc}' WHERE id = ${r.id};\n`;
}

sql += "COMMIT;\n";

fs.writeFileSync('C:/Users/Ranniere/.gemini/antigravity/brain/fa879587-5113-4f00-88e7-81c3259a9609/update_descricoes.sql', sql);
console.log("SQL gerado com sucesso!");
