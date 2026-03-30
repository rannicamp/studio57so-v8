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
    console.log("🕵️ Investigação Aprofundada do Lote 24/11/2025...");

    const { data: cPassivo } = await supabase.from('contas_financeiras')
        .select('id').ilike('tipo', '%Passivo%').limit(1);
    const passivo_id = cPassivo[0].id;

    // Queremos investigar apenas os boletos no Passivo com as descrições/valores ligados a este lote.
    // Especialmente entender por que há 5 boletos de R$ 1.925,00 lá DENTRO da Antecipações.

    const { data: lancamentos } = await supabase.from('lancamentos')
        .select('id, valor, data_vencimento, descricao, antecipacao_grupo_id, status, conta_id')
        .eq('conta_id', passivo_id)
        .in('valor', [1925.00, 3498.60, 4170.83])
        .eq('tipo', 'Receita')
        .order('data_vencimento', { ascending: true });

    let md = `# 🕵️ Investigação Detalhada: Lote 24/11/2025\n\n`;
    md += `O robô filtrou **EXCLUSIVAMENTE a sua Conta Passiva (Antecipações)** para entender exatamente quais destes boletos pertencem a esse borderô ou se estão amarrados a outros já processados.\n\n`;

    md += `| Venc. Original | Valor (R$) | Descrição | ID Banco | Agrupado? |\n`;
    md += `| --- | --- | --- | --- | --- |\n`;

    for (const l of lancamentos) {
        const vinculado = l.antecipacao_grupo_id ? `✅ Lote Fechado` : `🟡 Livre (Nenhum lote)`;
        const valueP = `R$ ${l.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        md += `| ${formatBR(l.data_vencimento)} | **${valueP}** | ${l.descricao.substring(0, 40)} | \`${l.id}\` | ${vinculado} |\n`;
    }

    md += `\n### 💡 Ponto de Atenção\n`;
    md += `Se houver boletos marcados como "Livre" (sem \`antecipacao_grupo_id\`), estes são exatamente os boletos virgens do Lote 24/11 que aguardam selagem. Se houver mais de um, precisamos escolher os que têm vencimentos mais próximos do borderô.\n`;

    fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/INVESTIGACAO_DETALHADA_2411.md', md);
    console.log("✅ Relatório de Investigação do Lote 24/11 gerado.");
}

main().catch(console.error);
