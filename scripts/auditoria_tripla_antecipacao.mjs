import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outFile = 'C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/auditoria_tripla_antecipacao.md';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Buscar contas de antecipação
    const { data: contas } = await supabase
        .from('contas_financeiras')
        .select('id, nome')
        .ilike('nome', '%ANTECIPA%');

    if (!contas || contas.length === 0) return;
    const contaIds = contas.map(c => c.id);

    // 1. Buscar OS BOLETOS que estão na conta de antecipação (Receitas)
    const { data: boletosBanco } = await supabase
        .from('lancamentos')
        .select('id, descricao, valor, tipo, data_transacao, data_vencimento, antecipacao_grupo_id, conta_id')
        .in('conta_id', contaIds)
        .eq('tipo', 'Receita');

    // 2. Buscar AS SAÍDAS (Despesas) da conta de antecipação
    const { data: saidasAntecipacao } = await supabase
        .from('lancamentos')
        .select('id, descricao, valor, tipo, data_transacao, data_vencimento, antecipacao_grupo_id, conta_id')
        .in('conta_id', contaIds)
        .eq('tipo', 'Despesa');

    // 3. Buscar AS ENTRADAS NO CAIXA (Receitas fora da conta antecipação)
    const { data: entradasCaixa } = await supabase
        .from('lancamentos')
        .select('id, descricao, valor, tipo, data_transacao, data_vencimento, antecipacao_grupo_id, conta_id, contas_financeiras(nome)')
        .not('conta_id', 'in', `(${contaIds.join(',')})`)
        .eq('tipo', 'Receita');


    let md = `# 🔎 Auditoria de Trinca (A Regra dos 3 Lançamentos)\n\n`;
    md += `> [!NOTE]\n> Validando a regra de negócio do Studio 57: Para CADA boleto na conta de antecipação, deve existir exatamente **UMA SAÍDA** na mesma conta e **UMA ENTRADA** na conta destino com o mesmo valor.\n\n`;

    let perfeitos = 0;
    let quebrados = 0;

    md += `## ⚠️ Boletos com Trinca Quebrada (Incompletos)\n\n`;

    boletosBanco.forEach(boleto => {
        const valAbsoluto = Math.abs(Number(boleto.valor));
        const valFormatado = valAbsoluto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        // Acha a Saída (Mesmo Valor, Mesma Conta, Tipo Despesa)
        let despesaMatch = saidasAntecipacao.find(d => 
            Math.abs(Number(d.valor)) === valAbsoluto && 
            (boleto.antecipacao_grupo_id && d.antecipacao_grupo_id === boleto.antecipacao_grupo_id || !boleto.antecipacao_grupo_id)
        );

        // Se tem várias despesas avulsas com mesmo valor, pegamos a primeira q bater data aproximada ou algo, mas para auditoria simples:
        if (!despesaMatch) {
            despesaMatch = saidasAntecipacao.find(d => Math.abs(Number(d.valor)) === valAbsoluto);
        }

        // Acha a Entrada no Caixa (Mesmo Valor, Tipo Receita, Conta Diferente)
        let receitaCaixaMatch = entradasCaixa.find(r => 
            Math.abs(Number(r.valor)) === valAbsoluto && 
            (boleto.antecipacao_grupo_id && r.antecipacao_grupo_id === boleto.antecipacao_grupo_id || !boleto.antecipacao_grupo_id)
        );

        if (!receitaCaixaMatch) {
            receitaCaixaMatch = entradasCaixa.find(r => Math.abs(Number(r.valor)) === valAbsoluto);
        }

        const dataVenc = new Date(boleto.data_vencimento || boleto.data_transacao).toLocaleDateString('pt-BR');

        if (despesaMatch && receitaCaixaMatch) {
            perfeitos++;
        } else {
            quebrados++;
            md += `### 📄 Boleto: **${valFormatado}** (ID: ${boleto.id.toString().slice(0,6)})\n`;
            md += `- **Vencimento:** ${dataVenc} | **Descrição:** ${boleto.descricao}\n`;
            
            md += `> [!CAUTION]🚨 **DIAGNÓSTICO DA TRINCA**\n`;
            if (!despesaMatch) {
                md += `> ❌ **FALTA A SAÍDA:** Não existe nenhuma Despesa de ${valFormatado} saindo da conta de Antecipação.\n`;
            } else {
                md += `> ✅ **Saída encontrada:** Despesa de ${valFormatado} localizada.\n`;
            }

            if (!receitaCaixaMatch) {
                md += `> ❌ **FALTA A ENTRADA NO CAIXA:** O dinheiro nunca caiu na conta corrente de destino!\n`;
            } else {
                md += `> ✅ **Entrada encontrada:** Receita de ${valFormatado} localizada na conta ${receitaCaixaMatch.contas_financeiras?.nome}.\n`;
            }
            md += `---\n\n`;
        }
    });

    md += `## ✅ Resumo\n`;
    md += `- **Boletos com a Trinca Perfeita:** ${perfeitos}\n`;
    md += `- **Boletos com Falhas na Trinca:** ${quebrados}\n`;

    fs.writeFileSync(outFile, md);
    console.log("Auditoria tripla concluida.");
}

main();
