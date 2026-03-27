const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("==> Iniciando extração total (Conta 40 - Sicoob)...");
    
    const { data: lancamentos, error } = await supabase
        .from('lancamentos')
        .select('id, data_vencimento, valor, descricao, status, created_at')
        .eq('conta_id', 40)
        .order('data_vencimento', { ascending: false });

    if (error) {
        console.error("Erro ao buscar:", error);
        return;
    }

    const fs = require('fs');

    let md = `# Dossiê Completo de Lançamentos Sicoob 6482 (ID 40)\n\n`;
    md += `*Total de lançamentos encontrados: ${lancamentos.length}*\n\n`;
    md += `| ID | Vencimento | Valor (R$) | Descrição | Status | Criado Em |\n`;
    md += `|---|---|---|---|---|---|\n`;

    lancamentos.forEach(l => {
        md += `| ${l.id} | ${l.data_vencimento} | ${l.valor} | ${l.descricao.replace(/\|/g, '-')} | ${l.status} | ${l.created_at} |\n`;
    });

    fs.writeFileSync('C:\\Users\\ranni\\.gemini\\antigravity\\brain\\2f63ec5f-6037-40cb-a9e4-3048bbcaf9f9\\fatura_sicoob_analise.md', md, 'utf-8');
    console.log("Dossiê gerado com sucesso no arquivo do artefato!");
}

run();
