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
    console.log("🕵️ Iniciando Caça Global de Boletos Perdidos em Múltiplas Camadas...");

    // Os valores exatos que sumiram no lote de 07/11/2025
    const alvos = [4333.33, 26000.00, 4495.12, 7706.37];

    // Carregar o nome das contas para ficar legível
    const { data: contas } = await supabase.from('contas_financeiras').select('id, nome');
    const nomeConta = (id) => contas?.find(c => c.id === id)?.nome || `ID ${id}`;

    // Buscar TODAS as Receitas com esses valores nominais (ou negativos se por acaso tiverem lançado errado)
    const { data: lancamentos } = await supabase.from('lancamentos')
        .select('id, valor, descricao, data_vencimento, conta_id, tipo, antecipacao_grupo_id')
        .in('valor', alvos.flatMap(v => [v, -v]))
        .eq('tipo', 'Receita') // Focando em Receitas de Boleto
        .order('data_vencimento', { ascending: true });

    let md = `# 🕵️ Investigação Global: Lote 07/11/2025\n\n`;
    md += `A pedido, o sistema rompeu a barreira da "Conta de Passivo" e foi buscar receitas com os exatos valores perdidos **em todas as contas financeiras do sistema**.\n\n`;

    for (const valorBase of alvos) {
        md += `## 🎯 Alvo: R$ ${valorBase.toLocaleString('pt-BR', {minimumFractionDigits:2})}\n`;

        const encontrados = lancamentos?.filter(l => Math.abs(Number(l.valor)) === valorBase) || [];

        md += `**Camada 1 (Global):** Encontrados **${encontrados.length}** registros com esse valor exato no banco inteiro.\n\n`;

        if (encontrados.length === 0) continue;

        // Camada 2: Agrupamento por Conta
        const porConta = {};
        for(const item of encontrados) {
            if(!porConta[item.conta_id]) porConta[item.conta_id] = [];
            porConta[item.conta_id].push(item);
        }

        md += `### 🗂️ Distribuição por Contas Financeiras:\n`;
        
        for (const [cId, itens] of Object.entries(porConta)) {
            md += `#### 🏛️ Conta: ${nomeConta(Number(cId))} (${itens.length} boletos encontrados)\n`;
            
            md += `| Venc. Banco | Valor BD | Descrição | ID Banco | Vinculado Lote? |\n`;
            md += `| --- | --- | --- | --- | --- |\n`;
            
            for(const item of itens) {
                // Destacar se as datas coincidem com a zona do lote de NOV/DEZ/JAN
                let dateBadge = formatBR(item.data_vencimento);
                if (item.data_vencimento.startsWith('2025-11') || item.data_vencimento.startsWith('2025-12') || item.data_vencimento.startsWith('2026-01') || item.data_vencimento.startsWith('2026-02')) {
                    dateBadge = `**🔥 ${dateBadge}**`;
                }
                
                let groupStatus = item.antecipacao_grupo_id ? 'Sim' : 'Não';
                
                md += `| ${dateBadge} | R$ ${item.valor} | ${item.descricao.substring(0, 30)}... | \`${item.id}\` | ${groupStatus} |\n`;
            }
            md += `\n`;
        }
        md += `---\n`;
    }

    fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/INVESTIGACAO_LOTES.md', md);
    console.log("Relatório Investigativo Global gerado 🕵️‍♂️");
}

main().catch(console.error);
