import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("🔍 Buscando contas de passivo...");
    const { data: contasPassivo } = await supabase.from('contas_financeiras')
        .select('id, nome').ilike('tipo', '%Passivo%');
    const contaIds = contasPassivo ? contasPassivo.map(c => c.id) : [];
    console.log("Contas encontradas:", contaIds);

    if (contaIds.length === 0) {
        console.error("Nenhuma conta do tipo Passivo encontrada.");
        return;
    }

    console.log("🔍 Buscando Boletos (Receitas no Passivo)...");
    const { data: receitas, error: rErr } = await supabase.from('lancamentos')
        .select('id, valor, descricao, data_vencimento, data_pagamento, created_at')
        .in('conta_id', contaIds).eq('tipo', 'Receita')
        .order('data_vencimento', { ascending: false });
    if(rErr) console.error("Erro Receitas:", rErr);

    console.log("🔍 Buscando Saídas/Transferências (Despesas no Passivo)...");
    const { data: despesas, error: dErr } = await supabase.from('lancamentos')
        .select('id, valor, descricao, data_vencimento, data_pagamento, created_at')
        .in('conta_id', contaIds).eq('tipo', 'Despesa')
        .order('data_pagamento', { ascending: false });
    if(dErr) console.error("Erro Despesas:", dErr);

    const safeReceitas = receitas || [];
    const safeDespesas = despesas || [];

    console.log(`Receitas encontradas: ${safeReceitas.length}, Despesas: ${safeDespesas.length}`);

    // Filtrar despesas que NÃO TÊM um boleto único com valor exato (ou seja, as despesas de LOTE)
    const despesasLote = safeDespesas.filter(d => {
        return !safeReceitas.some(r => Math.abs(Number(r.valor)) === Math.abs(Number(d.valor)));
    });

    // Boletos órfãos
    const receitasOrfas = safeReceitas.filter(r => {
        return !safeDespesas.some(d => Math.abs(Number(d.valor)) === Math.abs(Number(r.valor)));
    });

    let md = `# 🕵️‍♂️ Investigação de Lotes de Antecipação\n\n`;
    
    md += `## 📦 Despesas de Lote (Saídas Suspeitas do Passivo)\n`;
    md += `*Essas são transferências que **NÃO** bateram 1 pra 1 com nenhum boleto e provavelmente agrupam vários.*\n\n`;
    md += `| ID | Despesa Lote | Venc/Pagamento | Created At | Valor Agrupado |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    
    despesasLote.forEach(d => {
        const val = Math.abs(Number(d.valor)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dt = d.data_pagamento || d.data_vencimento || '-';
        md += `| ${d.id.toString().substring(0,6)} | <small>${d.descricao}</small> | ${dt} | ${new Date(d.created_at).toLocaleDateString('pt-BR')} | **${val}** |\n`;
    });

    md += `\n---\n## 🧩 Peças do Quebra-Cabeça (Boletos Órfãos)\n`;
    md += `*Boletos que não têm saída e precisam caber dentro dos bolões acima.*\n\n`;
    md += `| ID | Boleto (Receita) | Venc/Pagamento | Created At | Valor Unitário |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    
    receitasOrfas.forEach(r => {
        const val = Math.abs(Number(r.valor)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dt = r.data_pagamento || r.data_vencimento || '-';
        md += `| ${r.id.toString().substring(0,6)} | <small>${r.descricao}</small> | ${dt} | ${new Date(r.created_at).toLocaleDateString('pt-BR')} | **${val}** |\n`;
    });

    const outFile = 'C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/INVESTIGACAO_LOTES.md';
    fs.writeFileSync(outFile, md);
    console.log(`Relatório gerado em: ${outFile}`);
}

main();
