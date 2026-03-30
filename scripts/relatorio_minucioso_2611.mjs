import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const pad = (num) => num.toString().padStart(2, '0');
const formatDateStr = (dateStr) => {
    const d = new Date(dateStr);
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};

const boletosBorder = [
    { alvo: "1.925-A", dateStrVenc: "10/02/2026", valor: 1925, min: 1924, max: 1926 },
    { alvo: "1.925-B", dateStrVenc: "10/02/2026", valor: 1925, min: 1924, max: 1926 },
    { alvo: "4.495,12", dateStrVenc: "20/02/2026", valor: 4495.12, min: 4494, max: 4496 },
    { alvo: "3.498,60", dateStrVenc: "10/02/2026", valor: 3498.60, min: 3497, max: 3499 },
    { alvo: "4.170,83", dateStrVenc: "10/02/2026", valor: 4170.83, min: 4169, max: 4172 },
    { alvo: "7.706,37", dateStrVenc: "15/02/2026", valor: 7706.37, min: 7705, max: 7708 },
    { alvo: "4.289,13", dateStrVenc: "19/02/2026", valor: 4289.13, min: 4288, max: 4291 },
    { alvo: "4.246,67-A", dateStrVenc: "19/02/2026", valor: 4246.67, min: 4245, max: 4248 },
    { alvo: "4.246,67-B", dateStrVenc: "19/01/2026", valor: 4246.67, min: 4245, max: 4248 },
];

async function main() {
    console.log("🕵️ Iniciando Busca Cirúrgica (Lote 26/11)");
    let content = `# 🎯 Busca Cirúrgica: Lote 26/11/2025\n\n`;

    // Vamos buscar todas as contas bancárias para resolver nomes
    const { data: contas } = await supabase.from('contas').select('id, nome');
    const mapConta = {};
    if (contas) contas.forEach(c => mapConta[c.id] = c.nome);

    const vistos = new Set(); // Para não duplicar resultados ao buscar 1925 duas vezes ou 4246 duas vezes

    for (let meta of boletosBorder) {
        if (vistos.has(meta.alvo.substring(0,4))) {
            continue; // Se já buscamos 1925, pulamos a segunda passada pois trará a mesma lista.
        }
        vistos.add(meta.alvo.substring(0,4));

        content += `## 🔍 Alvo: Valores próximos a R$ ${meta.valor}\n`;
        content += `**Procurando Boletos com o Valor (inclusive dízimas) ao redor de ${meta.valor}**\n\n`;

        const { data: dbData } = await supabase.from('lancamentos')
            .select('id, valor, data_vencimento, descricao, conta_id, antecipacao_grupo_id')
            .eq('tipo', 'Receita')
            .gte('valor', meta.min)
            .lte('valor', meta.max)
            .order('data_vencimento', { ascending: true });

        if (!dbData || dbData.length === 0) {
            content += `⚠️ *Nenhum boleto encontrado nessa faixa de valor no BD!*\n\n`;
            continue;
        }

        content += `| Venc. BD | Valor Real BD | Status | ID Boleto | Descrição Lançamento | Conta Atual |\n`;
        content += `| --- | --- | --- | --- | --- | --- |\n`;

        for (let row of dbData) {
            let trDate = formatDateStr(row.data_vencimento);
            let status = row.antecipacao_grupo_id ? '🔴 Tem dono' : '🟢 VIRGEM';
            let iconDate = '📅';

            content += `| ${iconDate} ${trDate} | R$ ${row.valor} | ${status} | \`${row.id}\` | ${row.descricao.substring(0,30)} | ${row.conta_id} - ${mapConta[row.conta_id] || ''} |\n`;
        }
        content += `\n---\n`;
    }

    fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/RELATORIO_CIRURGICO_2611.md', content);
    console.log("✅ Relatório de cirurgia gerado em RELATORIO_CIRURGICO_2611.md");
}

main().catch(console.error);
