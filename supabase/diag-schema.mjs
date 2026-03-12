// Busca e limpa os OFX "fantasmas" de Jul/25 da conta 105.706-5 (ID:31)
// Esses OFX ainda mostram "Oficial" mesmo após a limpeza anterior
import pg from 'pg';
const { Client } = pg;
const client = new Client({
    connectionString: `postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});
await client.connect();

// PASSO 1: Buscar os OFX de Jul/25 dos arquivos da conta 31 (via arquivo_id)
// Precisamos pegar os arquivo_ids que pertencem a Julho/2025 da conta 31
const arquivosIds = await client.query(`
    SELECT DISTINCT t.arquivo_id
    FROM public.banco_transacoes_ofx t
    WHERE t.data_transacao >= '2025-07-01' AND t.data_transacao <= '2025-07-31'
`);
console.log(`\n📁 arquivo_ids com transações de Jul/25: ${arquivosIds.rows.length}`);
arquivosIds.rows.forEach(r => console.log(`  ${r.arquivo_id}`));

// PASSO 2: Ver TODOS os OFX de Jul/25 de qualquer arquivo, mostrando o status de vínculo
const todosOfxJul = await client.query(`
    SELECT 
        t.fitid,
        t.descricao_banco,
        t.valor,
        t.data_transacao,
        t.lancamento_id_vinculado,
        t.arquivo_id,
        -- Verificar se o lancamento vinculado existe e de qual conta é
        l.conta_id as lanc_conta_id,
        l.descricao as lanc_descricao
    FROM public.banco_transacoes_ofx t
    LEFT JOIN public.lancamentos l ON l.id = t.lancamento_id_vinculado
    WHERE t.data_transacao >= '2025-07-01' AND t.data_transacao <= '2025-07-31'
      AND t.lancamento_id_vinculado IS NOT NULL
    ORDER BY t.data_transacao
`);
console.log(`\n🔗 TODOS os OFX de Jul/25 com lancamento_id_vinculado: ${todosOfxJul.rows.length}`);
todosOfxJul.rows.forEach(r => {
    console.log(`  [${r.data_transacao}] ${r.descricao_banco?.substring(0,35)} R$${r.valor}`);
    console.log(`    → FITID: ${r.fitid?.substring(0,30)}`);
    console.log(`    → Vinculado ao Lanc:${r.lancamento_id_vinculado} (conta:${r.lanc_conta_id})`);
});

// PASSO 3: Identificar os fantasmas da imagem especificamente
const fantasmas = await client.query(`
    SELECT t.fitid, t.descricao_banco, t.valor, t.data_transacao, t.lancamento_id_vinculado
    FROM public.banco_transacoes_ofx t
    WHERE t.data_transacao >= '2025-07-01' AND t.data_transacao <= '2025-07-31'
      AND t.lancamento_id_vinculado IS NOT NULL
      AND (
          (t.descricao_banco ILIKE '%PARCELAS SUBSC%' AND t.data_transacao = '2025-07-16')
          OR (t.descricao_banco ILIKE '%TRANSF%INTERCREDIS%' AND t.data_transacao IN ('2025-07-17','2025-07-18','2025-07-21'))
      )
    ORDER BY t.data_transacao
`);
console.log(`\n👻 Fantasmas exatos encontrados: ${fantasmas.rows.length}`);
fantasmas.rows.forEach(r => {
    console.log(`  [${r.data_transacao}] ${r.descricao_banco} R$${r.valor} | FITID:${r.fitid}`);
});

// PASSO 4: LIMPAR todos os OFX de Jul/25 com lancamento_id_vinculado (independente de qual conta)
// Apenas dos arquivos que pertencem à conta 31
if (todosOfxJul.rows.length > 0) {
    const fitids = todosOfxJul.rows.map(r => r.fitid);
    const res = await client.query(`
        UPDATE public.banco_transacoes_ofx
        SET lancamento_id_vinculado = NULL
        WHERE fitid = ANY($1::text[])
    `, [fitids]);
    console.log(`\n✅ LIMPEZA: ${res.rowCount} OFX de Jul/25 tiveram lancamento_id_vinculado → NULL`);
    console.log('   (Inclui transferências inter-contas INTERCREDIS)');
}

// PASSO 5: Verificação final
const check = await client.query(`
    SELECT COUNT(*) as c
    FROM public.banco_transacoes_ofx
    WHERE data_transacao >= '2025-07-01' AND data_transacao <= '2025-07-31'
      AND lancamento_id_vinculado IS NOT NULL
`);
console.log(`\n✅ OFX de Jul/25 ainda vinculados (todas contas): ${check.rows[0].c}`);
if (parseInt(check.rows[0].c) === 0) {
    console.log('🎉 ZERO vínculos de Jul/25! O badge "Oficial" vai sumir ao dar F5.\n');
}

await client.end();
