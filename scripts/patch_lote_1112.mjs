import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GROUP_ID_11_12 = 'fde56d96-baef-48da-9142-598de24a91ee';
const CONTA_ANTECIPACAO = 33; // Conta 33 - Antecipações Sicoob Crediriodoce
const CATEGORIA_ANTECIPACAO = 351; // 351 = Antecipação de Recebíveis

async function main() {
    console.log("🚀 Iniciando Fechamento do Lote 11/12...");

    // 1. Atualizando a "Transferência Master" 
    const { error: err1 } = await supabase.from('lancamentos')
        .update({ categoria_id: CATEGORIA_ANTECIPACAO })
        .eq('id', 10782); // ID da transferência do lote de 11/12
    if (err1) console.error("Erro ao atualizar Despesa de Transferência:", err1);
    else console.log("✅ Categoria da Transferência-Pai atualizada para 351.");

    // 2. Acerto do Samuel (dízima) e Atribuição do lote
    console.log("🛠️ Limpando dízimas e Carimbando a Conta 33...");
    const { error: errSam } = await supabase.from('lancamentos').update({ 
        valor: 8017.19, 
        categoria_id: CATEGORIA_ANTECIPACAO, 
        conta_id: CONTA_ANTECIPACAO, 
        antecipacao_grupo_id: GROUP_ID_11_12,
        conciliado: false, data_pagamento: null
    }).eq('id', 9004);
    if (errSam) console.error("ERRO Samuel", errSam);
    else console.log("✅ Samuel (9004) -> R$ 8017.19 cravados na Conta 33");

    // 3. Os boletos limpos: Matheus, Alsenir e Alessandra
    const boletosProntos = [
        { id: 8794, nome: "Matheus (4276.91)" },
        { id: 10701, nome: "Alsenir (4205.83)" },
        { id: 16732, nome: "Alessandra (14380.00)" }
    ];

    for (const b of boletosProntos) {
        const { error: errUpd } = await supabase.from('lancamentos').update({ 
            categoria_id: CATEGORIA_ANTECIPACAO, 
            conta_id: CONTA_ANTECIPACAO, 
            antecipacao_grupo_id: GROUP_ID_11_12,
            conciliado: false, 
            data_pagamento: null
        }).eq('id', b.id);
        
        if (errUpd) console.error(`❌ Erro em ${b.nome}:`, errUpd);
        else console.log(`✅ ${b.nome} carimbado na Conta 33.`);
    }

    // 4. Auditoria Final Mágica
    const { data: fechamento } = await supabase.from('lancamentos')
        .select('valor')
        .eq('antecipacao_grupo_id', GROUP_ID_11_12);
        
    const soma = fechamento.reduce((acc, cr) => acc + Number(cr.valor), 0);
    console.log(`\n💰 SOMA TOTAL DO GRUPO NO BD: R$ ${soma.toFixed(2)}`);
    console.log(`🎯 META DO SICOOB: R$ 30.879,93`);
    
    if (Math.abs(soma - 30879.93) < 0.05) {
        console.log(`🏆 MATCH PERFEITO! 11/12 LIQUIDADO NA MATEMÁTICA!`);
    } else {
        console.log(`⚠️ ATENÇÃO: Discrepância na soma final = R$ ${(soma - 30879.93).toFixed(2)}`);
    }
}

main().catch(console.error);
