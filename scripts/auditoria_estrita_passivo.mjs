import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outFile = 'C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/auditoria_estrita_passivo.md';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Buscar APENAS contas categorizadas tecnicamente como PASSIVO
    // O usuário determinou: "verificar APENAS os boletos que estão na conta de antecipação que é do tipo passivos".
    const { data: contasPassivo } = await supabase
        .from('contas_financeiras')
        .select('id, nome, tipo')
        .ilike('tipo', '%Passivo%'); // Garante que a raiz é passivo absoluto

    if (!contasPassivo || contasPassivo.length === 0) return;
    const contaIds = contasPassivo.map(c => c.id);

    // Começar a verificação ESTRITAMENTE a partir dos boletos alojados nestas contas de passivo
    const { data: boletosPassivo } = await supabase
        .from('lancamentos')
        .select('id, descricao, valor, tipo, data_vencimento, contas_financeiras(nome)')
        .in('conta_id', contaIds)
        .eq('tipo', 'Receita');

    let md = `# 🛡️ Triagem Estrita de Boletos (Filtro: Passivo Absoluto)\n\n`;
    md += `> [!NOTE]\n> **Filtro Aplicado:** A verificação começou **exclusivamente** a partir dos boletos que **já estão** alocados em Contas Financeiras com o tipo \`Conta de Passivo\` no banco de dados. Qualquer boleto que caiu na conta corrente (vida que segue) foi 100% ignorado.\n\n`;

    md += `As contas de passivo vasculhadas foram:\n`;
    contasPassivo.forEach(c => {
         md += `- 🏦 **${c.nome}** (ID: ${c.id})\n`;
    });
    md += `\n---\n\n`;

    md += `Encontramos **${boletosPassivo.length} boletos** repousando nessas contas do banco.\n`;
    
    // Tabela rápida de amostra
    md += `| Vencimento | Valor | Conta Hospedeira | Descrição | \n`;
    md += `| :--- | :--- | :--- | :--- | \n`;
    
    // Pega só os 10 primeiros por amostragem para provar ao usuário
    const amostra = boletosPassivo.slice(0, 15);
    amostra.forEach(b => {
         const dataFormatada = b.data_vencimento ? new Date(b.data_vencimento).toLocaleDateString('pt-BR') : 'Sem Data';
         const val = Number(b.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
         md += `| ${dataFormatada} | **${val}** | ${b.contas_financeiras?.nome} | <small>${b.descricao?.replace(/\n/g, ' ')}</small> |\n`;
    });

    if (boletosPassivo.length > 15) {
         md += `| ... | *(Mais ${boletosPassivo.length - 15} registros omitidos)* | ... | ... |\n`;
    }

    fs.writeFileSync(outFile, md);
    console.log("Auditoria Passivo Concluida.");
}

main();
