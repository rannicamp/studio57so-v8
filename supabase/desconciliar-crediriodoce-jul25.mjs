// supabase/desconciliar-crediriodoce-jul25.mjs
// Script para LIMPAR a conciliação de Julho/2025 da conta Crediriodoce
// Contas identificadas: ID=31 (Conta Corrente) e ID=34 (Cartão Crédito), org_id=2

import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: `postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log('✅ Conectado ao banco de dados!\n');

// IDs das contas Crediriodoce (conta corrente e cartão)
// Caso queira incluir apenas a conta corrente, deixe só o 31.
const CONTAS_IDS = [31, 34];
const ORG_ID = 2;

console.log(`📌 Contas alvo: ${CONTAS_IDS.join(', ')} | Org: ${ORG_ID}`);
console.log('📅 Período: Julho/2025 (2025-07-01 a 2025-07-31)\n');

// ============================================================
// PASSO 1: Preview - lançamentos que serão desconciliados
// ============================================================
console.log('🔍 PASSO 1: Verificando lançamentos conciliados de julho/2025...');

const previewLanc = await client.query(`
    SELECT 
        id,
        LEFT(descricao, 40) as descricao,
        valor,
        tipo,
        status,
        conciliado,
        LEFT(fitid_banco::text, 25) as fitid_banco,
        data_pagamento,
        data_vencimento,
        agrupamento_id IS NOT NULL as tem_agrupamento
    FROM public.lancamentos
    WHERE conta_id = ANY($1::bigint[])
      AND organizacao_id = $2
      AND (
          (data_pagamento >= '2025-07-01' AND data_pagamento <= '2025-07-31')
          OR (data_vencimento >= '2025-07-01' AND data_vencimento <= '2025-07-31' AND data_pagamento IS NULL)
          OR (data_transacao >= '2025-07-01' AND data_transacao <= '2025-07-31' AND data_pagamento IS NULL AND data_vencimento IS NULL)
      )
      AND (conciliado = true OR fitid_banco IS NOT NULL)
    ORDER BY COALESCE(data_pagamento, data_vencimento, data_transacao);
`, [CONTAS_IDS, ORG_ID]);

console.log(`📊 Lançamentos com conciliação ativa: ${previewLanc.rows.length}`);
previewLanc.rows.forEach(r => {
    console.log(`  ID:${r.id} | ${r.data_pagamento || r.data_vencimento} | ${r.tipo} | R$ ${r.valor} | ${r.descricao}`);
});

// ============================================================
// PASSO 2: Preview - transações OFX vinculadas
// ============================================================
console.log('\n🔍 PASSO 2: Verificando transações OFX vinculadas de julho/2025...');

const previewOfx = await client.query(`
    SELECT 
        t.fitid,
        LEFT(t.descricao_banco, 35) as descricao,
        t.valor,
        t.data_transacao,
        t.lancamento_id_vinculado
    FROM public.banco_transacoes_ofx t
    WHERE t.lancamento_id_vinculado IS NOT NULL
      AND t.data_transacao >= '2025-07-01'
      AND t.data_transacao <= '2025-07-31'
      AND EXISTS (
          SELECT 1 FROM public.lancamentos l 
          WHERE l.id = t.lancamento_id_vinculado 
            AND l.conta_id = ANY($1::bigint[])
      )
    ORDER BY t.data_transacao;
`, [CONTAS_IDS]);

console.log(`📊 Registros OFX vinculados: ${previewOfx.rows.length}`);
previewOfx.rows.forEach(r => {
    console.log(`  FITID:${r.fitid} | ${r.data_transacao} | R$ ${r.valor} | Vinculado ao Lanc:${r.lancamento_id_vinculado}`);
});

// ============================================================
// Verificar se há algo a fazer
// ============================================================
if (previewLanc.rows.length === 0 && previewOfx.rows.length === 0) {
    console.log('\n✅ Nenhum dado de conciliação encontrado para julho/2025. Nada a limpar!');
    await client.end();
    process.exit(0);
}

// ============================================================
// PASSO 3: EXECUTAR A LIMPEZA
// ============================================================
console.log('\n⚠️  INICIANDO LIMPEZA...');
console.log(`   Serão afetados: ${previewLanc.rows.length} lançamentos e ${previewOfx.rows.length} vínculos OFX\n`);

// 3a: Limpar vínculos OFX PRIMEIRO (para não quebrar FK depois)
if (previewOfx.rows.length > 0) {
    const fitids = previewOfx.rows.map(r => r.fitid);
    const r1 = await client.query(`
        UPDATE public.banco_transacoes_ofx
        SET lancamento_id_vinculado = NULL
        WHERE fitid = ANY($1::text[])
    `, [fitids]);
    console.log(`✅ OFX limpos: ${r1.rowCount} registros (lancamento_id_vinculado → NULL)`);
}

// 3b: Limpar lançamentos (fitid_banco, conciliado, status, data_pagamento)
if (previewLanc.rows.length > 0) {
    const lancIds = previewLanc.rows.map(r => r.id);
    const r2 = await client.query(`
        UPDATE public.lancamentos
        SET 
            fitid_banco = NULL,
            conciliado = false,
            status = 'Pendente',
            data_pagamento = NULL
        WHERE id = ANY($1::bigint[])
          AND organizacao_id = $2
    `, [lancIds, ORG_ID]);
    console.log(`✅ Lançamentos limpos: ${r2.rowCount} registros`);
    console.log(`   (fitid_banco → NULL, conciliado → false, status → 'Pendente', data_pagamento → NULL)`);
}

// ============================================================
// PASSO 4: Verificação Final
// ============================================================
console.log('\n🔍 PASSO 4: Confirmação final...');

const check = await client.query(`
    SELECT COUNT(*) as restantes
    FROM public.lancamentos
    WHERE conta_id = ANY($1::bigint[])
      AND organizacao_id = $2
      AND (
          (data_pagamento >= '2025-07-01' AND data_pagamento <= '2025-07-31')
          OR (data_vencimento >= '2025-07-01' AND data_vencimento <= '2025-07-31')
      )
      AND (conciliado = true OR fitid_banco IS NOT NULL)
`, [CONTAS_IDS, ORG_ID]);

const restantes = parseInt(check.rows[0].restantes);
if (restantes === 0) {
    console.log('\n🎉 SUCESSO TOTAL! Julho/2025 da conta Crediriodoce está 100% limpo!');
    console.log('   Agora você pode reimportar o OFX e conciliar do zero. ✨\n');
} else {
    console.log(`\n⚠️  Atenção: ainda restam ${restantes} lançamentos com conciliação.`);
    console.log('   Verifique se há lançamentos com datas em outros campos.\n');
}

await client.end();
console.log('🏁 Script finalizado!\n');
