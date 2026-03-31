import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GROUP_29_01 = 'ce19df43-1579-43c1-b062-8e1d51c7da2c';
const TRANSFER_ID = 12294;
const CONTA_ANTECIPACAO = 33;
const CATEGORIA_ANTECIPACAO = 351;

async function main() {
    console.log("🧹 Iniciando Operação Faxina: Lote 29/01/2026...");

    // 1. Limpando Dízimas
    console.log("🛠️ Capinando centavos das dízimas...");
    await supabase.from('lancamentos').update({ valor: 4333.33 }).eq('id', 7748);
    await supabase.from('lancamentos').update({ valor: 4333.33 }).eq('id', 7747);
    await supabase.from('lancamentos').update({ valor: 4170.83 }).eq('id', 8051);
    
    // 2. Categoria da Transferência-Mãe
    await supabase.from('lancamentos').update({ categoria_id: CATEGORIA_ANTECIPACAO }).eq('id', TRANSFER_ID);

    // 3. Empacotar Boletos na Conta 33
    const boletos = [7748, 7747, 8051, 10702];
    for (const b of boletos) {
        const { error: errUpd } = await supabase.from('lancamentos').update({ 
            categoria_id: CATEGORIA_ANTECIPACAO, 
            conta_id: CONTA_ANTECIPACAO, 
            antecipacao_grupo_id: GROUP_29_01,
            conciliado: false, 
            data_pagamento: null
        }).eq('id', b);
        
        if (errUpd) console.error(`❌ Erro em ID ${b}:`, errUpd);
        else console.log(`✅ Boleto ID ${b} validado na Conta 33.`);
    }

    // 4. Auditoria Matemática Final
    const { data: fechamento } = await supabase.from('lancamentos')
        .select('valor')
        .eq('antecipacao_grupo_id', GROUP_29_01);
        
    const soma = fechamento.reduce((acc, cr) => acc + Number(cr.valor), 0);
    console.log(`\n💰 SOMA TOTAL DO GRUPO NO BD: R$ ${soma.toFixed(2)}`);
    console.log(`🎯 META DO SICOOB: R$ 17.043,32`);
    
    if (Math.abs(soma - 17043.32) < 0.05) {
        console.log(`🏆 MATCH PERFEITO! 29/01 LIQUIDADO NA MATEMÁTICA!`);
    } else {
        console.log(`⚠️ ATENÇÃO: Discrepância na soma final = R$ ${(soma - 17043.32).toFixed(2)}`);
    }
}

main().catch(console.error);
