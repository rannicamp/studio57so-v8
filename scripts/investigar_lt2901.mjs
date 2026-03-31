import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function caçarBoleto(nome, valorAlvo, datamin, datamax) {
    const { data: b } = await supabase.from('lancamentos')
        .select(`id, descricao, valor, data_vencimento, data_pagamento, conta_id, categoria_id, antecipacao_grupo_id`)
        .gte('valor', valorAlvo - 2)
        .lte('valor', valorAlvo + 2)
        .gte('data_vencimento', datamin)
        .lte('data_vencimento', datamax)
        .eq('tipo', 'Receita');
        
    console.log(`\n🔎 Buscando ${nome} (~${valorAlvo}) entre ${datamin} e ${datamax}:`);
    if(b && b.length > 0) {
        b.forEach(x => console.log(`   [ID ${x.id}] Venc: ${x.data_vencimento} | R$ ${x.valor} | ${x.descricao} | Conta: ${x.conta_id} | Grupo: ${x.antecipacao_grupo_id || 'VAZIO'}`));
    } else {
         console.log(`   ❌ NADA ENCONTRADO (Fantasma!)`);
    }
}

async function main() {
    console.log("=== CAÇADOR DE BOLETOS: LOTE 29/01/2026 ===");
    await caçarBoleto('Marcelo (Março)', 4333.33, '2026-03-15', '2026-03-30');
    await caçarBoleto('Marcelo (Fev)', 4333.33, '2026-02-15', '2026-02-28');
    await caçarBoleto('Darlene (Abril)', 4170.83, '2026-04-05', '2026-04-15');
    await caçarBoleto('Alsenir (Abril)', 4205.83, '2026-04-01', '2026-04-10');
}
main().catch(console.error);
