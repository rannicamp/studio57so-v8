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
    console.log("🕵️ Iniciando Investigação Global: Lote 24/11/2025");

    // Alvos exatos:
    const alvos = [1925.00, 3498.60, 4170.83];

    const { data: contas } = await supabase.from('contas_financeiras').select('id, nome');
    const nomeConta = (id) => contas?.find(c => c.id === id)?.nome || `ID ${id}`;

    const { data: lancamentos } = await supabase.from('lancamentos')
        .select('id, valor, descricao, data_vencimento, conta_id, tipo, antecipacao_grupo_id')
        .in('valor', alvos.flatMap(v => [v, -v]))
        .eq('tipo', 'Receita')
        .order('data_vencimento', { ascending: true });

    let md = `# 🕵️ Investigação Global: Lote 24/11/2025\n\n`;
    md += `Abaixo os boletos que possuem os valores deste lote espalhados por todo o banco de dados:\n\n`;

    for (const valorBase of alvos) {
        md += `## 🎯 Alvo: R$ ${valorBase.toLocaleString('pt-BR', {minimumFractionDigits:2})}\n`;
        const encontrados = lancamentos?.filter(l => Math.abs(Number(l.valor)) === valorBase) || [];
        md += `**Camada 1 (Global):** Encontrados **${encontrados.length}** registros com esse valor exato no banco inteiro.\n\n`;

        if (encontrados.length === 0) continue;

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
                let dateBadge = formatBR(item.data_vencimento);
                if (item.data_vencimento.startsWith('2026-01') || item.data_vencimento.startsWith('2026-02')) {
                    dateBadge = `**🔥 ${dateBadge}**`; // Destaque na zona quente da disputa
                }
                
                let groupStatus = item.antecipacao_grupo_id ? 'Sim' : 'Não';
                md += `| ${dateBadge} | R$ ${item.valor} | ${item.descricao.substring(0, 30)}... | \`${item.id}\` | ${groupStatus} |\n`;
            }
            md += `\n`;
        }
        md += `---\n`;
    }

    fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/INVESTIGACAO_LOTES_LOTE2.md', md);
    console.log("✅ Relatório do Lote 2 gerado com sucesso.");
}

main().catch(console.error);
