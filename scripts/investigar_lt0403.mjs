import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("=== RAIOS-X: MISTÉRIO DOS 44.591,89 ===");
    
    // Consultando o lancamento Mestre
    const { data: mestre } = await supabase.from('lancamentos').select('*').eq('id', 14041).single();
    if(mestre) {
        console.log(`\n👑 [MESTRE 14041] Venc: ${mestre.data_vencimento} | Data Pagamento: ${mestre.data_pagamento}`);
        console.log(`Descricao: ${mestre.descricao}`);
        console.log(`Valor Original: R$ ${mestre.valor} | Valor Pago: R$ ${mestre.valor_pago}`);
        console.log(`Conta: ${mestre.conta_id} | Origem Caixa: ${mestre.ignorar_fluxo_caixa}`);
        console.log(`Grupo: ${mestre.antecipacao_grupo_id}`);
    } else {
        console.log(`❌ Mestre 14041 não encontrado!`);
    }

    // Consultando todos os boletos vinculados a esse grupo atualmente
    if (mestre?.antecipacao_grupo_id) {
        const { data: vinculados } = await supabase.from('lancamentos').select('id, valor, descricao, data_vencimento, data_pagamento').eq('antecipacao_grupo_id', mestre.antecipacao_grupo_id);
        
        console.log(`\n📦 BOLETOS ATRELADOS AO GRUPO DA MESTRE:`);
        vinculados.forEach(v => {
            console.log(`  [ID ${v.id}] Venc: ${v.data_vencimento} | R$ ${v.valor} | ${v.descricao}`);
        });

        const somaAtrelados = vinculados.reduce((acc, cr) => acc + Number(cr.valor), 0);
        console.log(`SOMA: R$ ${somaAtrelados}`);
    }

    // Consultar Despesas do Sicoob Proxímas a Março
    const { data: despesas } = await supabase.from('lancamentos')
        .select('id, valor, data_pagamento, descricao')
        .eq('tipo', 'Despesa')
        .gte('data_pagamento', '2026-03-01')
        .lte('data_pagamento', '2026-03-31')
        .ilike('descricao', '%Sicoob%')
        .order('data_pagamento', { ascending: true });
        
    console.log(`\n🔎 DESPESAS SICOOB EM MARÇO:`);
    despesas?.forEach(d => {
        console.log(`  [ID ${d.id}] ${d.data_pagamento} | R$ ${d.valor} | ${d.descricao}`);
    });
}
main().catch(console.error);
