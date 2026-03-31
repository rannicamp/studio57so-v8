import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("=== CAÇADOR DE DÉBITO: SICOOB (Jan/2026) ===");

    // Procurando Despesas perto de 10/01 a 20/01 na Conta 31 com valor ~3498.60 (pode ser negativo)
    const { data: despesas, error } = await supabase.from('lancamentos')
        .select(`id, descricao, valor, data_vencimento, data_pagamento, conciliado, conta_id, categoria_id, tipo, antecipacao_grupo_id`)
        .eq('tipo', 'Despesa')
        .gte('data_vencimento', '2026-01-10')
        .lte('data_vencimento', '2026-01-20');

    if (error) {
        console.error("Erro na busca:", error);
        return;
    }

    const candidatos = despesas.filter(d => Math.abs(d.valor) >= 3498 && Math.abs(d.valor) <= 3600);
    console.log(`Encontradas ${candidatos.length} despesas suspeitas neste range de dias:`);
    console.log(candidatos);

    // E buscar se ja criaram uma Receita na Conta 33 porventura:
    const { data: receitas33, error: err2 } = await supabase.from('lancamentos')
        .select(`id, descricao, valor, data_vencimento, conta_id, antecipacao_grupo_id`)
        .eq('conta_id', 33)
        .gte('data_vencimento', '2026-01-10')
        .lte('data_vencimento', '2026-01-20');
        
    const recCand = receitas33?.filter(r => Math.abs(r.valor) >= 3498 && Math.abs(r.valor) <= 3600);
    console.log(`\nEncontradas ${recCand?.length || 0} receitas soltas na Conta 33 no mesmo periodo:`);
    console.log(recCand);
}

main().catch(console.error);
