import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("=== CAÇADOR DE FANTASMAS: O MISTÉRIO DE MARCELO (22/04) ===");
    
    // Primeiro chute: ID sequencial
    const idS = 7749;
    const { data: d1 } = await supabase.from('lancamentos').select('id, data_vencimento, valor, descricao, conta_id').eq('id', idS).single();
    if(d1) console.log(`\n🔎 CHUTE ID ${idS}: Venc: ${d1.data_vencimento} | R$ ${d1.valor} | ${d1.descricao} | Conta: ${d1.conta_id}`);
    
    // Busca abrangente pelo nome na descricão ou todos acima de 4000
    const { data: b } = await supabase.from('lancamentos')
        .select(`id, descricao, valor, data_vencimento, data_pagamento, conta_id, categoria_id`)
        .ilike('descricao', '%Marcelo%');
        
    console.log(`\n🔎 BUSCA NOME 'Marcelo':`);
    if(b && b.length > 0) {
        b.forEach(x => console.log(`   [ID ${x.id}] Venc: ${x.data_vencimento} | R$ ${x.valor} | ${x.descricao}`));
    } else {
        console.log(`❌ Ninguém com Marcelo na descrição.`);
    }

    // Busca pela data exata
    const { data: c } = await supabase.from('lancamentos')
        .select(`id, descricao, valor, data_vencimento, data_pagamento, conta_id, categoria_id`)
        .eq('data_vencimento', '2026-04-22')
        .eq('tipo', 'Receita');
        
    console.log(`\n🔎 BUSCA VENCIMENTO EXATO '2026-04-22':`);
    if(c && c.length > 0) {
        c.forEach(x => console.log(`   [ID ${x.id}] R$ ${x.valor} | ${x.descricao}`));
    } else {
        console.log(`❌ Ninguém achado nessa data.`);
    }
}
main().catch(console.error);
