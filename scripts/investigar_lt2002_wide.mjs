import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cacarWide(nome, valorAlvo) {
    const { data: b } = await supabase.from('lancamentos')
        .select(`id, descricao, valor, data_vencimento, data_pagamento, conta_id, categoria_id, antecipacao_grupo_id`)
        .eq('tipo', 'Receita')
        .gte('valor', valorAlvo - 2)
        .lte('valor', valorAlvo + 2)
        .order('data_vencimento', { ascending: true });
        
    console.log(`\n🔎 [WIDE SEARCH] ${nome} (~${valorAlvo}):`);
    if(b && b.length > 0) {
        b.forEach(x => {
            if (x.data_vencimento >= '2025-10-01' && x.data_vencimento <= '2026-12-31') {
                console.log(`   [ID ${x.id}] Venc: ${x.data_vencimento} | R$ ${x.valor} | ${x.descricao} | Conta: ${x.conta_id} | Grupo: ${x.antecipacao_grupo_id || 'VAZIO'}`);
            }
        });
    } else {
         console.log(`   ❌ NADA ENCONTRADO ATÉ 2026!`);
    }
}

async function main() {
    console.log("=== CAÇADOR WIDE DE BOLETOS: LOTE 20/02/2026 ===");
    await cacarWide('Marcelo (Missing April 22)', 4333.33);
    await cacarWide('Alessandra/Angela (Missing April 10)', 1925.00);
    await cacarWide('Alessandra/Angela CONJUNTO (Missing April 10)', 3850.00);
    await cacarWide('Carolina (Missing April 15)', 1833.93);
    await cacarWide('Monte Alto (Missing Jun 15)', 7706.37);
}
main().catch(console.error);
