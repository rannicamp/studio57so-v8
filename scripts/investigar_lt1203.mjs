import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data: m1 } = await supabase.from('lancamentos').select('id, data_vencimento, valor, descricao, conta_id').eq('id', 13484).single();
    if(m1) {
        console.log(`\n🔎 [ID 13484] Venc: ${m1.data_vencimento} | R$ ${m1.valor} | ${m1.descricao} | Conta: ${m1.conta_id}`);
    } else {
        console.log(`\n❌ [ID 13484] NÃO EXISTE!`);
    }

    const { data: b } = await supabase.from('lancamentos')
        .select(`id, descricao, valor, data_vencimento, conta_id, categoria_id, antecipacao_grupo_id`)
        .eq('tipo', 'Despesa')
        .gte('data_pagamento', '2026-03-01')
        .lte('data_pagamento', '2026-03-31')
        .ilike('descricao', '%Sicoob%')
        .order('data_pagamento', { ascending: true });
        
    console.log(`\n🔎 DESPESAS SICOOB EM MARÇO:`);
    b?.forEach(x => {
        console.log(`   [ID ${x.id}] Venc: ${x.data_vencimento} | R$ ${x.valor} | ${x.descricao}`);
    });
}
main().catch(console.error);
