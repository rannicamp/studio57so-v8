import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function caçarBoleto(nome, vencimento, valorAlvos) {
    // valorAlvos is an array [base, possible_fat_value]
    let query = supabase.from('lancamentos')
        .select(`id, descricao, valor, data_vencimento, data_pagamento, conta_id, categoria_id, antecipacao_grupo_id`)
        .eq('tipo', 'Receita')
        .gte('data_vencimento', vencimento.substring(0, 8) + '01')
        .lte('data_vencimento', vencimento.substring(0, 8) + '31');
        
    const { data: b } = await query;
        
    console.log(`\n🔎 [${vencimento}] ${nome}:`);
    let found = false;
    for (const valor of valorAlvos) {
        const hits = b?.filter(x => Math.abs(x.valor - valor) < 5);
        if(hits && hits.length > 0) {
            hits.forEach(x => console.log(`   [ID ${x.id}] Venc: ${x.data_vencimento} | R$ ${x.valor} | ${x.descricao} | Conta: ${x.conta_id} | Grupo: ${x.antecipacao_grupo_id || 'VAZIO'}`));
            found = true;
        }
    }
    if(!found) console.log(`   ❌ NADA ENCONTRADO para valores [${valorAlvos.join(', ')}]`);
}

async function main() {
    console.log("=== CAÇADOR DE BOLETOS: LOTE 20/02/2026 ===");
    await caçarBoleto('Marcelo', '2026-04-22', [4333.33]);
    await caçarBoleto('Matheus', '2026-05-10', [4276.91]);
    await caçarBoleto('Alessandra/Angela (Abr)', '2026-04-10', [1925.00, 3850.00]);
    await caçarBoleto('Alessandra/Angela (Mai)', '2026-05-10', [1925.00, 3850.00]);
    await caçarBoleto('Karina Lucas', '2026-05-20', [4495.12]);
    await caçarBoleto('Carolina (Abr)', '2026-04-15', [1833.93]);
    await caçarBoleto('Carolina (Mai)', '2026-05-15', [1833.93]);
    await caçarBoleto('Darlene', '2026-05-10', [4170.83]);
    await caçarBoleto('Monte Alto (Mai)', '2026-05-15', [7706.37]);
    await caçarBoleto('Monte Alto (Jun)', '2026-06-15', [7706.37]);
    await caçarBoleto('José Rogério', '2026-05-19', [4289.13]);
    await caçarBoleto('José Rogério 2', '2026-05-19', [4246.67]);
}
main().catch(console.error);
