import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outFile = 'C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/RELATORIO_FINAL_AUDITORIA.md';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: contasPassivo } = await supabase.from('contas_financeiras').select('id, nome').ilike('tipo', '%Passivo%');
    const contaIds = contasPassivo.map(c => c.id);

    const { data: boletos } = await supabase
        .from('lancamentos')
        .select('id, descricao, valor, status, data_vencimento')
        .in('conta_id', contaIds).eq('tipo', 'Receita')
        .order('data_vencimento', { ascending: false });

    const { data: saidas } = await supabase.from('lancamentos')
        .select('valor, conta_id').in('conta_id', contaIds).eq('tipo', 'Despesa');

    const { data: entradas } = await supabase.from('lancamentos')
        .select('valor, contas_financeiras(nome)').not('conta_id', 'in', `(${contaIds.join(',')})`).eq('tipo', 'Receita');

    let md = `# 📊 Auditoria Facilitada: O que está certo e o que arrumar?\n\n`;
    md += `> [!NOTE]\n> Varredura de 100% dos boletos localizados nas Contas de Passivo (Antecipações).\n\n`;
    md += `| Trinca OK? | ID | Boleto (Receita) | Vencimento | Diagnóstico |\n`;
    md += `| :---: | :--- | :--- | :--- | :--- |\n`;

    boletos.forEach((b) => {
        const val = Math.abs(Number(b.valor));
        const form = val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dt = b.data_vencimento ? new Date(b.data_vencimento).toLocaleDateString('pt-BR') : '-';
        
        let temSaida = saidas.some(s => Math.abs(Number(s.valor)) === Math.abs(Number(b.valor)));
        let temEntrada = entradas.find(e => Math.abs(Number(e.valor)) === Math.abs(Number(b.valor)));

        let status = '';
        let trincaOkCol = '';
        if (temSaida && temEntrada) {
            status = `🟢 **PERFEITA** (Boleto, Saída e Entrada exatos)`;
            trincaOkCol = '✅ OK';
        } else if (!temSaida && temEntrada) {
            status = `⚠️ **VERIFICAR LOTE** (Falta saída isolada)`;
            trincaOkCol = ''; // Em branco conforme pedido
        } else if (temSaida && !temEntrada) {
            status = `🔴 Erro: Falta entrada`;
            trincaOkCol = '';
        } else {
            status = `🔴 Órfão: Nada encontrado`;
            trincaOkCol = '';
        }

        md += `| ${trincaOkCol} | ${b.id.toString().substring(0,6)} | **${form}** <br> *<small>${b.descricao}</small>* | ${dt} | ${status} |\n`;
    });

    fs.writeFileSync(outFile, md);
    console.log("MARKDOWN_GERADO_CLARO");
}
main();
