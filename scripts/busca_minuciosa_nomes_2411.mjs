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
    console.log("🕵️ Iniciando Varredura Suprema por Nome (Lote 24/11)");

    const alvos = [
        { nome: 'ALESSANDRA MONTE ALTO ALVIM', valorBase: 1925.00 },
        { nome: 'ANGELA MONTE ALTO ALVIM', valorBase: 1925.00 },
        { nome: 'PAULO ROBERTO GOVEA FILHO', valorBase: 3498.60 },
        { nome: 'DARLENE RIBEIRO SOUZA', valorBase: 4170.83 },
        { nome: 'MATHEUS VINICIUS DE ALMEIDA SILVA', valorBase: 4276.91 },
        { nome: 'ALSENIR DUARTE MONTE ALTO', valorBase: 4205.83 }
    ];

    let md = `# 🕵️ Varredura Suprema Lote 24/11 (Via Vendas e Clientes)\n\n`;

    const { data: contas } = await supabase.from('contas_financeiras').select('id, nome');
    const nomeConta = (id) => contas?.find(c => c.id === id)?.nome || `Conta ${id}`;

    for (const alvo of alvos) {
        md += `## 🎯 Alvo: ${alvo.nome} (Borderô pede: R$ ${alvo.valorBase})\n`;
        
        // 1. Achar o cliente
        const nomeBusca = alvo.nome.split(' ').slice(0, 2).join(' '); // ALESSANDRA MONTE
        const { data: clientes } = await supabase.from('clientes')
            .select('id, nome')
            .ilike('nome', `%${nomeBusca}%`);
            
        if (!clientes || clientes.length === 0) {
            md += `❌ Cliente não encontrado no CRM usando a busca: "${nomeBusca}"\n\n`;
            continue;
        }

        const cId = clientes[0].id;
        md += `👤 Cliente achado no BD: **${clientes[0].nome}** (ID: ${cId})\n`;

        // 2. Achar as vendas do cliente
        const { data: vendas } = await supabase.from('vendas')
            .select('id, unidade_id')
            .eq('cliente_id', cId);

        if (!vendas || vendas.length === 0) {
            md += `❌ Nenhuma venda ativa ligada a este cliente.\n\n`;
            continue;
        }

        const vIds = vendas.map(v => v.id);
        md += `🏢 Venda(s) do cliente ID: ${vIds.join(', ')}\n`;

        // 3. Puxar TODOS os lançamentos de receita dessa venda
        const { data: lancamentos } = await supabase.from('lancamentos')
            .select('id, valor, data_vencimento, descricao, conta_id, antecipacao_grupo_id')
            .in('venda_id', vIds)
            .eq('tipo', 'Receita')
            .order('data_vencimento', { ascending: true });

        // 4. Filtrar os que estão próximos do valor
        const minVal = alvo.valorBase - 5;
        const maxVal = alvo.valorBase + 5;
        
        const parecidos = lancamentos.filter(l => Math.abs(Number(l.valor)) >= minVal && Math.abs(Number(l.valor)) <= maxVal);

        if (parecidos.length === 0) {
             md += `❌ Nenhum boleto achado na faixa de valor esperado para este cliente.\n\n`;
             continue;
        }

        md += `\n### 📋 Boletos Encontrados Proximos ao Valor (Qualquer Arquivo/Conta):\n`;
        md += `| Venc. Banco | Valor Real | Conta Onde Está | Descrição | Status Grupo UUID |\n`;
        md += `| --- | --- | --- | --- | --- |\n`;

        for(const b of parecidos) {
            let grupoStr = b.antecipacao_grupo_id ? '🔴 Preso em Lote' : '🟢 LIVRE VIRGEM';
            md += `| ${formatBR(b.data_vencimento)} | **R$ ${b.valor}** | ${nomeConta(b.conta_id)} | ${b.descricao.substring(0,25)} | ${grupoStr} |\n`;
        }
        md += `\n---\n`;
    }

    fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/BUSCA_SUPREMA_2411.md', md);
    console.log("Busca Suprema Finalizada.");
}

main().catch(console.error);
