import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cacarWide(nome, dataInic, dataFim, valorAlvo) {
    const { data: b } = await supabase.from('lancamentos')
        .select(`id, descricao, valor, data_vencimento, data_pagamento, conta_id, categoria_id, antecipacao_grupo_id`)
        .eq('tipo', 'Receita')
        .gte('valor', valorAlvo - 2)
        .lte('valor', valorAlvo + 2)
        .gte('data_vencimento', dataInic)
        .lte('data_vencimento', dataFim)
        .order('data_vencimento', { ascending: true });
        
    if(b && b.length > 0) {
        b.forEach(x => {
            console.log(`   [ID ${x.id}] Venc: ${x.data_vencimento} | R$ ${x.valor} | ${x.descricao} | Conta: ${x.conta_id} | Grupo: ${x.antecipacao_grupo_id || 'VAZIO'}`);
        });
    } else {
         console.log(`   ❌ NADA ENCONTRADO (${nome} - ${valorAlvo}) em ${dataInic}`);
    }
}

async function main() {
    console.log("=== VARREDURA DE BOLETOS: MARÇO ===");
    
    console.log("\n--- LOTE 04/03 (Julho/2026)");
    await cacarWide('Marcelo', '2026-07-01', '2026-07-31', 4333.33);
    await cacarWide('Samuel', '2026-07-01', '2026-07-31', 8017.19);
    await cacarWide('Matheus', '2026-07-01', '2026-07-31', 4276.91);
    await cacarWide('Darlene', '2026-07-01', '2026-07-31', 4170.83);
    await cacarWide('Alsenir', '2026-07-01', '2026-07-31', 4205.83);

    console.log("\n--- LOTE 06/03 (Agosto/2026)");
    await cacarWide('Marcelo', '2026-08-01', '2026-08-31', 4333.33);
    await cacarWide('Samuel', '2026-08-01', '2026-08-31', 8017.19);
    await cacarWide('Matheus', '2026-08-01', '2026-08-31', 4276.91);
    await cacarWide('Darlene', '2026-08-01', '2026-08-31', 4170.83);
    await cacarWide('Alsenir', '2026-08-01', '2026-08-31', 4205.83);

    console.log("\n--- LOTE 10/03 (Setembro/2026)");
    await cacarWide('Marcelo', '2026-09-01', '2026-09-31', 4333.33);
    await cacarWide('Samuel', '2026-09-01', '2026-09-31', 8017.19);
}
main().catch(console.error);
