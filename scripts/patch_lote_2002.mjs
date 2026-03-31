import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GROUP_20_02 = '96f57e46-ab76-463f-b3c4-7cc4735a2140';
const TRANSFER_ID = 13756;
const CONTA_ANTECIPACAO = 33;
const CATEGORIA_ANTECIPACAO = 351;

async function main() {
    console.log("🧹 Iniciando Operação Faxina Maciça: Lote 20/02/2026...");

    // 1. Limpando Dízimas (5 Boletos Problemáticos)
    console.log("🛠️ Capinando centavos das dízimas...");
    await supabase.from('lancamentos').update({ valor: 4333.33 }).eq('id', 7749); // Marcelo
    await supabase.from('lancamentos').update({ valor: 4495.12 }).eq('id', 6724); // Karina
    await supabase.from('lancamentos').update({ valor: 4170.83 }).eq('id', 8052); // Darlene
    await supabase.from('lancamentos').update({ valor: 7706.37 }).eq('id', 8231); // Monte Alto (Mai)
    await supabase.from('lancamentos').update({ valor: 7706.37 }).eq('id', 8232); // Monte Alto (Jun)

    console.log("✅ Dízimas castradas com sucesso!");
    
    // 2. Categoria da Transferência-Mãe
    await supabase.from('lancamentos').update({ categoria_id: CATEGORIA_ANTECIPACAO }).eq('id', TRANSFER_ID);

    // 3. Empacotar Boletos na Conta 33
    // Marcelo(1), Matheus(1), Alessandra/Angela(4), Karina(1), Carolina(2), Darlene(1), Monte Alto(2), Jose Rogerio(2) = 14 boletos
    const boletos = [7749, 8795, 6759, 16715, 6760, 16716, 6724, 7979, 7980, 8052, 8231, 8232, 7838, 10022];
    let counter = 0;
    
    for (const b of boletos) {
        const { error: errUpd } = await supabase.from('lancamentos').update({ 
            categoria_id: CATEGORIA_ANTECIPACAO, 
            conta_id: CONTA_ANTECIPACAO, 
            antecipacao_grupo_id: GROUP_20_02,
            conciliado: false, 
            data_pagamento: null
        }).eq('id', b);
        
        if (errUpd) {
            console.error(`❌ Erro em ID ${b}:`, errUpd);
        } else {
            counter++;
            console.log(`✅ Boleto ID ${b} trancado na Conta 33.`);
        }
    }
    
    console.log(`\n📦 Total de boletos migrados com sucesso: ${counter}/14`);

    // 4. Auditoria Matemática Final
    const { data: fechamento } = await supabase.from('lancamentos')
        .select('valor')
        .eq('antecipacao_grupo_id', GROUP_20_02);
        
    const soma = fechamento.reduce((acc, cr) => acc + Number(cr.valor), 0);
    console.log(`\n💰 SOMA TOTAL DO GRUPO NO BD: R$ ${soma.toFixed(2)}`);
    console.log(`🎯 META DO SICOOB: R$ 52.592,59`);
    
    if (Math.abs(soma - 52592.59) < 0.05) {
        console.log(`🏆 MATCH PERFEITO! O COLOSSO DE 52K ESTÁ LIQUIDADO NA MATEMÁTICA!`);
    } else {
        console.log(`⚠️ ATENÇÃO: Discrepância na soma final = R$ ${(soma - 52592.59).toFixed(2)}`);
    }
}

main().catch(console.error);
