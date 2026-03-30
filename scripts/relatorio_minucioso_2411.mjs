import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function formatBR(dateStr) {
    if(!dateStr) return '';
    const p = dateStr.split('-');
    if(p.length !== 3) return dateStr;
    return `${p[2]}/${p[1]}/${p[0]}`;
}

async function main() {
    console.log("🕵️ Iniciando Busca Cirúrgica (Lote 24/11)");

    const alvos = [
        { desc: 'MATHEUS VINICIUS', d: '2026-01-10', v: 4276.91 },
        { desc: 'ALESSANDRA MONTE', d: '2026-01-10', v: 1925.00 },
        { desc: 'ANGELA MONTE', d: '2026-01-10', v: 1925.00 },
        { desc: 'PAULO ROBERTO', d: '2026-01-10', v: 3498.60 },
        { desc: 'DARLENE RIBEIRO', d: '2026-01-10', v: 4170.83 },
        { desc: 'ALSENIR DUARTE', d: '2026-01-05', v: 4205.83 }
    ];

    const { data: lancamentos } = await supabase.from('lancamentos')
        .select('id, valor, data_vencimento, descricao, conta_id, antecipacao_grupo_id')
        .eq('tipo', 'Receita');

    const { data: contas } = await supabase.from('contas_financeiras').select('id, nome');
    const nomeConta = (id) => contas?.find(c => c.id === id)?.nome || `Conta ${id}`;

    let md = `# 🎯 Busca Cirúrgica: Lote 24/11/2025\n\n`;

    for (const a of alvos) {
        md += `## 🔍 Alvo: ${a.desc}\n`;
        md += `**Procurando:** Vencimento ${formatBR(a.d)} | Valor R$ ${a.v}\n\n`;

        // 1. Busca TENTATIVA 1: Bater o valor E Bater a Data
        let hits = lancamentos.filter(l => 
            Math.abs(Number(l.valor)) >= (a.v - 0.5) && Math.abs(Number(l.valor)) <= (a.v + 0.5) &&
            l.data_vencimento === a.d
        );

        // 2. Busca TENTATIVA 2: Se não bater a data exata, mostrar todos com esse valor
        if (hits.length === 0) {
            md += `⚠️ *Aviso: Nenhum boleto achado com essa data cravada (${formatBR(a.d)}). Buscando apenas pelo valor e data próxima...*\n`;
            hits = lancamentos.filter(l => 
                Math.abs(Number(l.valor)) >= (a.v - 0.5) && Math.abs(Number(l.valor)) <= (a.v + 0.5)
            );
        }

        if (hits.length === 0) {
            md += `🚨 **CRÍTICO: Absolutamente nenhum boleto achado com esse valor em todo o banco!**\n\n`;
            continue;
        }

        md += `| Venc. BD | Valor Real BD | Status | ID Boleto | Descrição Lançamento | Conta Atual |\n`;
        md += `| --- | --- | --- | --- | --- | --- |\n`;

        for (const h of hits) {
            let status = h.antecipacao_grupo_id ? '🔴 Tem dono' : '🟢 VIRGEM';
            let iconDate = h.data_vencimento === a.d ? '🎯' : '📅';
            let contaStatus = h.conta_id === 33 ? '🏦 PASSIVO' : nomeConta(h.conta_id); // 33 geralmente é a conta de antecipação
            md += `| ${iconDate} ${formatBR(h.data_vencimento)} | R$ ${h.valor} | ${status} | \`${h.id}\` | ${h.descricao.substring(0,30)} | ${contaStatus} |\n`;
        }
        md += `\n---\n`;
    }

    fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/RELATORIO_CIRURGICO_2411.md', md);
}

main().catch(console.error);
