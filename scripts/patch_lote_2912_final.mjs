import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GROUP_24_11 = '533b1dfe-f9ed-4d1e-a612-2a5a1f5a4565';
const GROUP_29_12 = '9c403fa6-3ebe-4b2f-89a8-e1bf0ff196e7';
const CONTA_ANTECIPACAO = 33;
const CATEGORIA_ANTECIPACAO = 351;

async function main() {
    console.log("🚀 Iniciando Mega-Operação: Paulo Roberto & Lote 29/12...");

    const { data: boletoPaulo } = await supabase.from('lancamentos').select('*').eq('id', 7907).single();
    if(!boletoPaulo) {
        console.error("❌ ERRO FATAL: Boleto 7907 do Paulo não achado!");
        return;
    }

    const orgId = boletoPaulo.organizacao_id;
    const contatoId = boletoPaulo.favorecido_contato_id;

    // === PARTE A: RECOMPOSIÇÃO DO LOTE 24/11 ===
    console.log("🛠️ Inserindo Repasse Sicoob na Conta 33...");
    const { data: recSicoob, error: errSicoob } = await supabase.from('lancamentos').insert({
        descricao: "Débito por Atraso - Parcela 16 Paulo",
        valor: 3498.60,
        conta_id: CONTA_ANTECIPACAO,
        categoria_id: CATEGORIA_ANTECIPACAO,
        tipo: 'Receita',
        antecipacao_grupo_id: GROUP_24_11,
        data_vencimento: '2026-01-13',
        data_pagamento: '2026-01-13',
        conciliado: true,
        organizacao_id: orgId,
        favorecido_contato_id: contatoId
    }).select('id');
    
    if(errSicoob) console.error("Erro ao criar reposição Sicoob", errSicoob);
    else console.log(`✅ Reposição Lote 24/11 Criada (ID ${recSicoob[0].id})`);

    // === PARTE B: CORRIGINDO O PAGAMENTO DE PAULO (Cisão de Juros) ===
    console.log("🛠️ Fracionando Juros do Paulo na Conta Corrente...");
    const agrpUUID = randomUUID();
    
    // 1. Volta o 7907 pra 3498.60 e bota UUID
    await supabase.from('lancamentos')
        .update({ valor: 3498.60, agrupamento_id: agrpUUID })
        .eq('id', 7907);

    // 2. Insere os 92.12 de juros
    await supabase.from('lancamentos').insert({
        descricao: "Juros e Multa por Atraso - Parcela 16 Paulo",
        valor: 92.12,
        conta_id: 31,
        categoria_id: boletoPaulo.categoria_id,
        tipo: 'Receita',
        data_vencimento: boletoPaulo.data_vencimento,
        data_pagamento: boletoPaulo.data_pagamento,
        conciliado: true,
        agrupamento_id: agrpUUID,
        organizacao_id: orgId,
        favorecido_contato_id: contatoId
    });
    console.log("✅ Pagamento Paulo (Conta 31) cindido em Principal + Juros e linkados!");

    // === PARTE C: PREPARAÇÃO E SELAGEM DO LOTE 29/12 ===
    console.log("🛠️ Ajustando Deformações e Aplicando Selo Lote 29/12...");
    
    // 1. Arrumar data do Paulo e limpar dízima do Zé Rogério
    await supabase.from('lancamentos').update({ data_vencimento: '2026-03-10' }).eq('id', 7909);
    await supabase.from('lancamentos').update({ valor: 4289.13 }).eq('id', 7837);
    
    // 2. Categoria da Transferência-Mãe (ID 12293)
    await supabase.from('lancamentos').update({ categoria_id: CATEGORIA_ANTECIPACAO }).eq('id', 12293);

    const boletos = [8793, 7978, 8050, 8229, 10020, 7837, 7909];
    
    for (const b of boletos) {
        const { error: errUpd } = await supabase.from('lancamentos').update({ 
            categoria_id: CATEGORIA_ANTECIPACAO, 
            conta_id: CONTA_ANTECIPACAO, 
            antecipacao_grupo_id: GROUP_29_12,
            conciliado: false, 
            data_pagamento: null
        }).eq('id', b);
        
        if (errUpd) console.error(`❌ Erro em ID ${b}:`, errUpd);
        else console.log(`✅ Boleto ID ${b} validado na Conta 33.`);
    }

    // === AUDITORIA FINAL 29/12 ===
    const { data: fechamento } = await supabase.from('lancamentos')
        .select('valor')
        .eq('antecipacao_grupo_id', GROUP_29_12);
        
    const soma = fechamento.reduce((acc, cr) => acc + Number(cr.valor), 0);
    console.log(`\n💰 SOMA TOTAL DO GRUPO NO BD: R$ ${soma.toFixed(2)}`);
    console.log(`🎯 META DO SICOOB: R$ 30.022,44`);
    
    if (Math.abs(soma - 30022.44) < 0.05) {
        console.log(`🏆 MATCH PERFEITO! 29/12 LIQUIDADO NA MATEMÁTICA!`);
    } else {
        console.log(`⚠️ ATENÇÃO: Discrepância na soma final = R$ ${(soma - 30022.44).toFixed(2)}`);
    }
}

main().catch(console.error);
