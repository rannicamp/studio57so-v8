import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outFile = 'C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/auditoria_antecipacoes_valores.md';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // 1. Procurar a conta alvo
    const { data: contas } = await supabase
        .from('contas_financeiras')
        .select('id, nome')
        .ilike('nome', '%756 - SICOOB CREDI RIODOCE ANTECIPAÇÕES%');

    if (!contas || contas.length === 0) {
        console.error("Conta SICOOB CREDI RIODOCE ANTECIPAÇÕES não encontrada!");
        return;
    }

    const contaPassivoId = contas[0].id;
    const contaPassivoNome = contas[0].nome;

    // 2. Buscar todas as "saídas" (Despesas) desta conta, com ou sem grupo
    const { data: saidasPassivo, error: errSaidas } = await supabase
        .from('lancamentos')
        .select(`
            id, descricao, valor, tipo, status, data_vencimento, data_transacao,
            antecipacao_grupo_id,
            categoria_id, categorias_financeiras ( nome )
        `)
        .eq('conta_id', contaPassivoId)
        .eq('tipo', 'Despesa')
        .order('data_vencimento', { ascending: false });

    if (errSaidas) {
        console.error("Erro base:", errSaidas);
        return;
    }

    // 3. Buscar TODAS as Receitas do sistema inteiro para tentar casar
    const { data: todasReceitas, error: errRec } = await supabase
        .from('lancamentos')
        .select(`
            id, descricao, valor, tipo, status, data_vencimento, data_transacao,
            conta_id, contas_financeiras ( nome ),
            antecipacao_grupo_id
        `)
        .eq('tipo', 'Receita');
        
    if (errRec) {
        console.error("Erro base 2:", errRec);
        return;
    }

    let md = `# 📊 Auditoria 1 para 1: Despesas vs Receitas\n\n`;
    md += `> [!NOTE]\n> **Conta Auditada:** 🏦 ${contaPassivoNome} (ID: ${contaPassivoId})\n> \n> **Regra Aplicada:** Para cada Despesa registrada nesta conta, o sistema varreu **todo o banco de dados** em busca de uma Receita com o mesmo valor exato. As correspondências levam em consideração o ID de Antecipação (se existir) ou cruzamento de data e valor.\n\n`;

    md += `Foram encontradas **${saidasPassivo.length}** despesas avulsas e agrupadas.\n\n`;

    // Vamos processar cada saída
    saidasPassivo.forEach(saida => {
        const valAbsoluto = Math.abs(Number(saida.valor));
        const valFormatado = valAbsoluto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dataOrigem = saida.data_transacao || saida.data_vencimento;
        
        // Critério de busca:
        // Prioridade 1: Mesma antecipacao_grupo_id se existir e valor bater
        // Prioridade 2: Mesmo valor exato (na margem de pouca diferença) E data_vencimento ou data_transacao próximos
        
        let matches = [];
        
        if (saida.antecipacao_grupo_id) {
            matches = todasReceitas.filter(r => 
                r.antecipacao_grupo_id === saida.antecipacao_grupo_id && 
                Math.abs(Number(r.valor)) === valAbsoluto
            );
        }

        // Se não achou pelo grupo, procura cego por valor no banco todo
        if (matches.length === 0) {
            matches = todasReceitas.filter(r => Math.abs(Number(r.valor)) === valAbsoluto);
            
            // Se encontrar muitas pelo valor, tenta estreitar pra mesma data
            if (matches.length > 1) {
                const matchsData = matches.filter(r => (r.data_transacao || r.data_vencimento) === dataOrigem);
                if (matchsData.length > 0) {
                    matches = matchsData;
                }
            }
        }

        md += `### 🔴 SAÍDA (Passivo): **-R$ ${valFormatado}** \n`;
        md += `- **Descrição:** ${saida.descricao}\n`;
        md += `- **Data:** ${new Date(dataOrigem).toLocaleDateString('pt-BR')}  | **Status:** ${saida.status} | **Grupo:** \`${saida.antecipacao_grupo_id || 'Sem Grupo (Avulso)'}\`\n\n`;

        if (matches.length === 0) {
            md += `> [!WARNING]🚨 **ALERTA CRÍTICO: ORFÃO!**\n`;
            md += `> Nenhuma Receita de ${valFormatado} foi encontrada em todo o sistema para balancear essa saída!\n\n`;
        } else if (matches.length === 1) {
            const m = matches[0];
            const contaNome = m.contas_financeiras?.nome || 'N/A';
            md += `> [!TIP]**🟢 ENTRADA ENCONTRADA!** (Balanço Perfeito)\n`;
            md += `> Receita de **+R$ ${valFormatado}** localizada na conta **${contaNome}**.\n`;
            md += `> *Descrição: ${m.descricao} (Apenas 1 correspondência exata garantida).* \n\n`;
        } else {
            md += `> [!CAUTION]⚠️ **ALERTA: MÚLTIPLAS ENTRADAS ENCONTRADAS**\n`;
            md += `> Foram encontradas ${matches.length} receitas com o valor exato no sistema. O balanço pode estar duplicado.\n`;
            matches.forEach(m => {
                const contaNome = m.contas_financeiras?.nome || 'N/A';
                md += `> - 🟢 **+R$ ${valFormatado}** na conta **${contaNome}** (${m.descricao})\n`;
            });
            md += `\n`;
        }
        
        md += `---\n\n`;
    });

    fs.writeFileSync(outFile, md);
    console.log("✔️ Auditoria gerada em " + outFile);
}

main();
