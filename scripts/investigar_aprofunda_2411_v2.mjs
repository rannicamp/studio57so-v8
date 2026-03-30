import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function formatBR(dateStr) {
    if(!dateStr) return 'Data Desconhecida';
    const p = dateStr.split('-');
    if(p.length !== 3) return dateStr;
    return `${p[2]}/${p[1]}/${p[0]}`;
}

async function main() {
    const { data: cPassivo } = await supabase.from('contas_financeiras')
        .select('id').ilike('tipo', '%Passivo%').limit(1);
    const passivo_id = cPassivo[0].id;

    // Buscar as receitas do passivo
    const { data: lancamentos } = await supabase.from('lancamentos')
        .select('id, valor, data_vencimento, descricao, antecipacao_grupo_id, status')
        .eq('conta_id', passivo_id)
        .in('valor', [1925.00, 3498.60, 4170.83])
        .eq('tipo', 'Receita')
        .order('data_vencimento', { ascending: true });

    // Buscar as despesas pai de cada grupo
    const agrupadosIds = [...new Set(lancamentos.map(l => l.antecipacao_grupo_id).filter(Boolean))];
    const { data: despesasLotes } = await supabase.from('lancamentos')
        .select('antecipacao_grupo_id, valor, data_vencimento, descricao')
        .in('antecipacao_grupo_id', agrupadosIds)
        .eq('tipo', 'Despesa'); // A transferência de saída

    const nomeDoLote = (uuid) => {
        const d = despesasLotes?.find(x => x.antecipacao_grupo_id === uuid);
        if(!d) return 'Lote Desconhecido';
        return `Lote ${formatBR(d.data_vencimento)} (Saída R$ ${d.valor})`;
    };

    let md = `# 🕵️ Investigação Aprofundada: Lote 24/11/2025\n\n`;
    md += `Abaixo estão TODOS os boletos guardados na gaveta de "Antecipações" para os valores deste borderô:\n\n`;

    md += `| Venc. BD | Valor | ID BD | Descrição | Pertence a Qual Lote? |\n`;
    md += `| --- | --- | --- | --- | --- |\n`;

    for (const l of lancamentos) {
        const vinculado = l.antecipacao_grupo_id ? `🚫 Preso no: ${nomeDoLote(l.antecipacao_grupo_id)}` : `✅ LIVRE (Podemos Usar!)`;
        md += `| ${formatBR(l.data_vencimento)} | **R$ ${l.valor}** | \`${l.id}\` | ${l.descricao.substring(0, 30)} | ${vinculado} |\n`;
    }

    fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/INVESTIGACAO_DETALHADA_2411.md', md);
    console.log("Relatório gerado.");
}

main().catch(console.error);
