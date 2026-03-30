import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outFile = 'C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/auditoria_completa_trinca_passivo.md';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // 1. Buscar TODAS as contas de Passivo
    const { data: contasPassivo } = await supabase
        .from('contas_financeiras')
        .select('id, nome')
        .ilike('tipo', '%Passivo%');

    if (!contasPassivo || contasPassivo.length === 0) return;
    const contaIds = contasPassivo.map(c => c.id);

    // 2. Buscar TODOS OS BOLETOS dentro destas contas (Receitas)
    const { data: boletosPassivo } = await supabase
        .from('lancamentos')
        .select('id, descricao, valor, status, data_vencimento, data_transacao, antecipacao_grupo_id, conta_id, contas_financeiras(nome)')
        .in('conta_id', contaIds)
        .eq('tipo', 'Receita')
        .order('data_vencimento', { ascending: false });

    // 3. Buscar TODAS AS SAÍDAS (Despesas) na mesma conta de passivo
    const { data: saidasPassivo } = await supabase
        .from('lancamentos')
        .select('id, descricao, valor, tipo, antecipacao_grupo_id, conta_id')
        .in('conta_id', contaIds)
        .eq('tipo', 'Despesa');

    // 4. Buscar TODAS AS ENTRADAS fora da conta de passivo
    const { data: entradasCaixa } = await supabase
        .from('lancamentos')
        .select('id, descricao, valor, tipo, antecipacao_grupo_id, conta_id, contas_financeiras(nome)')
        .not('conta_id', 'in', `(${contaIds.join(',')})`)
        .eq('tipo', 'Receita');

    let md = `# 📊 Auditoria Completa: Trinca do Passivo (100% dos Registros)\n\n`;
    md += `> [!NOTE]\n> Lista absolutamente detalhada de **TODOS os ${boletosPassivo.length} boletos** hospedados nas Contas de Passivo.\n> NENHUM REGISTRO FOI OMITIDO. O sistema busca e descreve a correspondência exata para cada boleto (Buscando a Saída na conta de Passivo e a Entrada na Conta Corrente).\n\n`;

    boletosPassivo.forEach((boleto, i) => {
        const valAbsoluto = Math.abs(Number(boleto.valor));
        const valFormatado = valAbsoluto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dataVenc = boleto.data_vencimento ? new Date(boleto.data_vencimento).toLocaleDateString('pt-BR') : 'S/D';
        const contaNome = boleto.contas_financeiras?.nome;
        
        md += `## ${i + 1}. Boleto: **${valFormatado}** (ID: ${boleto.id.toString().slice(0,6)})\n`;
        md += `- **Descrição:** ${boleto.descricao}\n`;
        md += `- **Vencimento:** ${dataVenc} | **Status:** ${boleto.status} | **Conta Passiva:** ${contaNome}\n`;

        // Achar Despesa (Saída do Passivo)
        let despesaMatch = saidasPassivo.find(d => Math.abs(Number(d.valor)) === valAbsoluto);
        // Achar Receita (Entrada na Corrente)
        let receitaCaixaMatch = entradasCaixa.find(r => Math.abs(Number(r.valor)) === valAbsoluto);

        if (despesaMatch && receitaCaixaMatch) {
            md += `> [!TIP]🟢 **Trinca Concluída com Sucesso:**\n`;
            md += `> 1️⃣ Boleto ${valFormatado} na Conta de Antecipação.\n`;
            md += `> 2️⃣ Saída de **-${valFormatado}** encontrada na própria Conta de Antecipação.\n`;
            md += `> 3️⃣ Entrada de **+${valFormatado}** localizada na conta **${receitaCaixaMatch.contas_financeiras?.nome}**.\n`;
        } else {
            md += `> [!CAUTION]🚨 **Falha na Correspondência Unitária:**\n`;
            
            if (despesaMatch) {
                md += `> ✅ **Saída encontrada:** Existe uma Despesa unitária de -${valFormatado} na conta de antecipação.\n`;
            } else {
                md += `> ❌ **FALTA SAÍDA:** Não existe nenhuma Despesa avulsa no valor exato de -${valFormatado} saindo da conta de Antecipação (Provavelmente agrupada em lote).\n`;
            }

            if (receitaCaixaMatch) {
                md += `> ✅ **Entrada localizada:** Encontrada uma injeção de +${valFormatado} na conta **${receitaCaixaMatch.contas_financeiras?.nome}**.\n`;
            } else {
                md += `> ❌ **FALTA ENTRADA:** Nenhuma injeção isolada de +${valFormatado} apareceu nas contas correntes.\n`;
            }
        }
        md += `\n---\n\n`;
    });

    fs.writeFileSync(outFile, md);
    console.log("Auditoria 100% Passivo gerada.");
}

main();
