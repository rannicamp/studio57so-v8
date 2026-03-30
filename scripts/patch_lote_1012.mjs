import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GROUP_ID_10_12 = 'c987d287-781c-4a72-86cd-c791c043d9c2';
const CONTA_ANTECIPACAO = 33; // Conta 33 - Antecipações Sicoob Crediriodoce
const CATEGORIA_ANTECIPACAO = 351; // 351 = Antecipação de Recebíveis

async function main() {
    console.log("🚀 Iniciando Fechamento do Lote 10/12...");

    // 1. Atualizando a "Transferência Master" 
    const { error: err1 } = await supabase.from('lancamentos')
        .update({ categoria_id: CATEGORIA_ANTECIPACAO })
        .eq('id', 10754);
    if (err1) console.error("Erro ao atualizar Despesa de Transferência:", err1);
    else console.log("✅ Categoria da Transferência-Pai atualizada para 351.");

    // 2. Acerto do Samuel e Karina
    console.log("🛠️ Limpando dízimas de valores...");
    await supabase.from('lancamentos').update({ 
        valor: 8017.19, 
        categoria_id: CATEGORIA_ANTECIPACAO, 
        conta_id: CONTA_ANTECIPACAO, 
        antecipacao_grupo_id: GROUP_ID_10_12,
        conciliado: false, data_pagamento: null
    }).eq('id', 9005);
    console.log("✅ Samuel (9005) -> R$ 8017.19");

    await supabase.from('lancamentos').update({ 
        valor: 4495.12, 
        categoria_id: CATEGORIA_ANTECIPACAO, 
        conta_id: CONTA_ANTECIPACAO, 
        antecipacao_grupo_id: GROUP_ID_10_12,
        conciliado: false, data_pagamento: null
    }).eq('id', 6722);
    console.log("✅ Karina (6722) -> R$ 4495.12");

    // 3. O Fatiamento Contratual (Boleto da Angela 6758 -> 2x 14380)
    console.log("🔪 Realizando Fatiamento da Parcela Intermediária...");
    const { data: boletoBase, error: errBase } = await supabase.from('lancamentos').select('*').eq('id', 6758).single();
    
    if (errBase) {
        console.error("❌ Erro ao buscar boleto da Angela", errBase);
    } else {
        // Preparando a Metade 2 (Alessandra)
        const novoBol = { ...boletoBase };
        delete novoBol.id;
        delete novoBol.created_at;
        novoBol.valor = 14380;
        novoBol.favorecido_contato_id = 3642; // Alessandra Monte Alto

        const { error: errIns } = await supabase.from('lancamentos').insert(novoBol);
        if (errIns) console.error("❌ Erro ao criar boleto da Alessandra:", errIns);
        else console.log("✅ Cópia para Alessandra criada (R$ 14.380,00 no passivo).");

        // Atualizando o boleto 1 (Angela) para ir pra Conta 33
        const { error: errUpd } = await supabase.from('lancamentos').update({ 
            valor: 14380, 
            categoria_id: CATEGORIA_ANTECIPACAO, 
            conta_id: CONTA_ANTECIPACAO, 
            antecipacao_grupo_id: GROUP_ID_10_12,
            conciliado: false, 
            data_pagamento: null
        }).eq('id', 6758);
        
        if (errUpd) console.error("❌ Erro ao atualizar cota da Angela:", errUpd);
        else console.log("✅ Cota da Angela (6758) selada na Antecipação de 10/12.");
    }

    // 4. Auditoria Final Mágica
    const { data: fechamento } = await supabase.from('lancamentos')
        .select('valor')
        .eq('antecipacao_grupo_id', GROUP_ID_10_12);
        
    const soma = fechamento.reduce((acc, cr) => acc + Number(cr.valor), 0);
    console.log(`\n💰 SOMA TOTAL DO GRUPO NO BD: R$ ${soma.toFixed(2)}`);
    console.log(`🎯 META DO SICOOB: R$ 26.892,31`);
    
    if (Math.abs(soma - 26892.31) < 0.05) {
        console.log(`🏆 MATCH PERFEITO! 10/12 LIQUIDADO NA MATEMÁTICA!`);
    } else {
        console.log(`⚠️ ATENÇÃO: Discrepância na soma final = R$ ${(soma - 26892.31).toFixed(2)}`);
    }
}

main().catch(console.error);
