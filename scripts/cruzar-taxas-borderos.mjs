// scripts/cruzar-taxas-borderos.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: '.env.local', override: true });

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` };

const BORDEROS = [
    { n:  1, data: '2025-08-04', taxa: 2235.80, op: '14416527' },
    { n:  2, data: '2025-09-02', taxa:  986.74, op: '14618626' },
    { n:  3, data: '2025-09-08', taxa:  960.33, op: '14658249' },
    { n:  4, data: '2025-09-23', taxa: 2595.25, op: '14766479' },
    { n:  5, data: '2025-10-29', taxa: 1534.66, op: '14999895' },
    { n:  6, data: '2025-11-07', taxa: 3240.58, op: '15060213' },
    { n:  7, data: '2025-11-24', taxa:  804.11, op: '15158891' },
    { n:  8, data: '2025-11-26', taxa: 3529.31, op: '15178027' },
    { n:  9, data: '2025-12-10', taxa: 2093.91, op: '15266665' },
    { n: 10, data: '2025-12-11', taxa: 2221.66, op: '15280721' },
    { n: 11, data: '2025-12-29', taxa: 1797.51, op: '15375915' },
    { n: 12, data: '2026-01-29', taxa:  764.18, op: '15559115' },
    { n: 14, data: '2026-02-20', taxa: 3388.79, op: '15694799' },
    { n: 15, data: '2026-03-04', taxa: 2747.17, op: '15763819' },
    { n: 16, data: '2026-03-06', taxa: 3305.20, op: '15783915' },
    { n: 17, data: '2026-03-10', taxa: 2555.53, op: '15808406' },
];

async function main() {
    // Busca TODAS as despesas no período
    const uri = `${URL_BASE}/rest/v1/lancamentos?select=id,data_transacao,valor,descricao,conta_id&organizacao_id=eq.2&tipo=eq.Despesa&data_transacao=gte.2025-08-01&data_transacao=lte.2026-03-31&order=data_transacao`;
    const res = await fetch(uri, { headers: H });
    const lancamentos = await res.json();

    console.log(`\n📦 Total despesas encontradas (ago/25 a mar/26): ${lancamentos.length}\n`);
    console.log('='.repeat(80));

    let achou = 0, naoAchou = 0;
    const resultado = [];

    for (const b of BORDEROS) {
        // Busca por valor exato (diferença < 0.02) dentro de 5 dias da data do borderô
        const dataB = new Date(b.data);
        const matches = lancamentos.filter(l => {
            const diff = Math.abs(parseFloat(l.valor) - b.taxa);
            if (diff >= 0.02) return false;
            const diffDias = Math.abs((new Date(l.data_transacao) - dataB) / 86400000);
            return diffDias <= 5;
        });

        // Lançamentos no mesmo dia (qualquer valor) para debug quando não achar
        const mesmoDia = lancamentos.filter(l => l.data_transacao === b.data);

        if (matches.length > 0) {
            achou++;
            matches.forEach(m => {
                console.log(`✅ Borderô ${b.n} | ${b.data} | Taxa: R$ ${b.taxa} → ID ${m.id} | ${m.data_transacao} | R$ ${parseFloat(m.valor).toFixed(2)} | Conta ${m.conta_id}`);
                console.log(`   Descrição: ${m.descricao}`);
                resultado.push({ bordero: b.n, data: b.data, taxa: b.taxa, op: b.op, id_banco: m.id, data_banco: m.data_transacao, valor_banco: parseFloat(m.valor), conta_id: m.conta_id, descricao: m.descricao, status: '✅' });
            });
        } else {
            naoAchou++;
            console.log(`❌ Borderô ${b.n} | ${b.data} | Taxa: R$ ${b.taxa} | Op: ${b.op} — NÃO ENCONTRADO`);
            if (mesmoDia.length > 0) {
                console.log(`   📅 Despesas no mesmo dia:`);
                mesmoDia.forEach(l => console.log(`      ID ${l.id} | R$ ${parseFloat(l.valor).toFixed(2)} | ${l.descricao} | Conta ${l.conta_id}`));
            } else {
                console.log(`   📅 Nenhuma despesa no mesmo dia`);
            }
            resultado.push({ bordero: b.n, data: b.data, taxa: b.taxa, op: b.op, id_banco: null, status: '❌' });
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 RESUMO: ${achou} encontradas | ${naoAchou} não encontradas\n`);
    console.log('\n🗃️ IDs encontrados (para update no banco):');
    resultado.filter(r => r.id_banco).forEach(r => {
        console.log(`   Borderô ${r.bordero} → ID ${r.id_banco} (R$ ${r.taxa} | Conta ${r.conta_id})`);
    });
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
