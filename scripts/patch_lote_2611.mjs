import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GROUP_ID_26_11 = '74c80491-bf83-4a5c-920b-fd4bf23ca47d';
const CONTA_ANTECIPACAO = 33; // Conta 33 - Antecipações Sicoob Crediriodoce

async function main() {
    console.log("🚀 Iniciando Fechamento do Lote 26/11...");

    // 1. Array principal de boletos felizes (sem acertos profundos)
    // 6757, 16714, 8049, 8228, 10018 (Os 5 recuperados da lista amarela)
    // 9003, 8792, 7977, 10700, 7835 (Os 5 perfeitos que não precisaram de revisão)
    const boletosNormais = [6757, 16714, 8049, 8228, 10018, 9003, 8792, 7977, 10700, 7835];
    const boletosDatasDerrapadas = [
        { id: 7836, targetDate: '2026-02-19' }, // Antes: 2026-02-20
        { id: 10019, targetDate: '2026-02-19' } // Antes: 2026-02-20
    ];
    const boletosValoresOcultos = [
        { id: 6721, targetValor: 4495.12 }, // Karina: Volta do valor corrigido pro base
        { id: 7908, targetValor: 3498.60 }  // Paulo: Volta do valor corrigido pro base
    ];

    // Array acumulador de todas as ids para agrupamento final em massa
    const todosBoletos = [...boletosNormais, ...boletosDatasDerrapadas.map(b => b.id), ...boletosValoresOcultos.map(b => b.id)];

    // 2. Corrigindo as datas derrapadas
    for(let bol of boletosDatasDerrapadas) {
        const { error } = await supabase.from('lancamentos')
            .update({ data_vencimento: bol.targetDate })
            .eq('id', bol.id);
        if(error) console.error(`❌ Erro ao atualizar data do boleto ${bol.id}:`, error);
        else console.log(`✅ Data de ${bol.id} corrigida para ${bol.targetDate}`);
    }

    // 3. Revertendo os valores de correção de índice (INCC/IGPM/Juros)
    for(let bol of boletosValoresOcultos) {
        const { error } = await supabase.from('lancamentos')
            .update({ valor: bol.targetValor })
            .eq('id', bol.id);
        if(error) console.error(`❌ Erro ao reverter valor do boleto ${bol.id}:`, error);
        else console.log(`✅ Valor de ${bol.id} revertido para R$ ${bol.targetValor} (Base do Borderô)`);
    }

    // 4. Selando o Agrupamento de Antecipação e Movendo para a Conta 33
    const { error: errorAgrup } = await supabase.from('lancamentos')
        .update({
            conta_id: CONTA_ANTECIPACAO,
            antecipacao_grupo_id: GROUP_ID_26_11,
            // Apenas para limpeza extra (conforme melhores práticas da Conta 33)
            conciliado: false,
            data_pagamento: null // Antecipação não deve ter status de pago de boleto original ainda até fechar tudo, ou ele segue pago pelo banco
        })
        .in('id', todosBoletos);

    if (errorAgrup) {
        console.error('❌ Erro no fechamento do lote:', errorAgrup);
    } else {
        console.log(`🎉 Sucesso! ${todosBoletos.length} boletos foram selados com sucesso no Lote 26/11.`);
        console.log(`👉 IDs Movidos: ${todosBoletos.join(', ')}`);
        
        // Conferindo matemática
        const { data: fechamento } = await supabase.from('lancamentos')
            .select('valor')
            .in('id', todosBoletos);
        
        const soma = fechamento.reduce((acc, cr) => acc + Number(cr.valor), 0);
        console.log(`\n💰 SOMA TOTAL DO GRUPO NO BD: R$ ${soma.toFixed(2)}`);
        console.log(`🎯 META DO SICOOB: R$ 59.126,38`);
        
        if (Math.abs(soma - 59126.38) < 0.05) {
            console.log(`🏆 MATCH PERFEITO! A MATEMÁTICA BATEU NA VÍRGULA!`);
        } else {
            console.log(`⚠️ ATENÇÃO: Discrepância na soma final = R$ ${(soma - 59126.38).toFixed(2)}`);
        }
    }
}

main().catch(console.error);
