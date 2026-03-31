import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cacarWide(nome, valorAlvo, mes) {
    const { data: b } = await supabase.from('lancamentos')
        .select(`id, descricao, valor, data_vencimento, data_pagamento, conta_id, categoria_id, antecipacao_grupo_id`)
        .eq('tipo', 'Receita')
        .gte('valor', valorAlvo - 2)
        .lte('valor', valorAlvo + 2)
        .gte('data_vencimento', `2026-${mes}-01`)
        .lte('data_vencimento', `2026-${mes}-31`)
        .order('data_vencimento', { ascending: true });
        
    if(b && b.length > 0) {
        b.forEach(x => {
            console.log(`   [ID ${x.id}] Venc: ${x.data_vencimento} | R$ ${x.valor} | ${x.descricao}`);
        });
    } else {
         console.log(`   ❌ NADA ENCONTRADO (${nome} - ${valorAlvo}) em 2026-${mes}`);
    }
}

async function cacarGlobal(nome, descricaoLike, valorBase) {
     const { data: b } = await supabase.from('lancamentos')
        .select(`id, descricao, valor, data_vencimento, data_pagamento, conta_id`)
        .eq('tipo', 'Receita')
        .ilike('descricao', descricaoLike);
        
    console.log(`\n🔎 [GLOBAL] Procurando ${nome}:`);
    let found = false;
    b?.forEach(x => {
       if(Math.abs(x.valor - valorBase) < 5)  {
           console.log(`   [ID ${x.id}] Venc: ${x.data_vencimento} | R$ ${x.valor} | ${x.descricao} | Conta: ${x.conta_id}`);
           found = true;
       }
    });
    if(!found) console.log(`   ❌ NADA ENCONTRADO globalmente para ${nome}`);
}

async function main() {
    console.log("=== COMPLEMENTO VARREDURA: MARÇO ===");
    
    console.log("\n--- LOTE 04/03 (Julho/2026) ---");
    await cacarWide('Alessandra/Angela', 1925.0, '07');
    await cacarWide('Carolina', 1833.93, '07');

    console.log("\n--- LOTE 06/03 (Agosto/2026) ---");
    await cacarWide('Alessandra/Angela', 1925.0, '08');
    await cacarWide('Carolina', 1833.93, '08');

    console.log("\n--- LOTE 10/03 (Setembro/2026 - Falhou Antes. Busca Global) ---");
    // ID 7749 was 22/04, 7752 is Julho, 7753 is Agosto. O que é 7754?
    const { data: m1 } = await supabase.from('lancamentos').select('id, data_vencimento, valor, descricao, conta_id').eq('id', 7754).single();
    if(m1) console.log(`\n🔎 CHUTE ID MARCELO 7754: Venc: ${m1.data_vencimento} | R$ ${m1.valor} | ${m1.descricao} | Conta: ${m1.conta_id}`);
    
    const { data: m2 } = await supabase.from('lancamentos').select('id, data_vencimento, valor, descricao, conta_id').eq('id', 9016).single();
    if(m2) console.log(`\n🔎 CHUTE ID SAMUEL 9016: Venc: ${m2.data_vencimento} | R$ ${m2.valor} | ${m2.descricao} | Conta: ${m2.conta_id}`);

    const { data: m3 } = await supabase.from('lancamentos').select('id, data_vencimento, valor, descricao, conta_id').eq('id', 8799).single();
    if(m3) console.log(`\n🔎 CHUTE ID MATHEUS 8799: Venc: ${m3.data_vencimento} | R$ ${m3.valor} | ${m3.descricao} | Conta: ${m3.conta_id}`);

    await cacarWide('Alessandra/Angela', 1925.0, '09');
    await cacarWide('Carolina', 1833.93, '09');
}
main().catch(console.error);
