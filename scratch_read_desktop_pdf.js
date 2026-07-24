const { Client } = require('pg');

const PG_CONN = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;

async function run() {
  const pgClient = new Client({
    connectionString: PG_CONN,
    ssl: { rejectUnauthorized: false }
  });
  await pgClient.connect();
  
  const res = await pgClient.query(`
    SELECT l.fatura_id, f.mes_referencia, l.descricao, l.valor, l.data_transacao
    FROM public.lancamentos l
    JOIN public.faturas_cartao f ON f.id = l.fatura_id
    WHERE l.organizacao_id = 12 AND l.descricao LIKE '%Parcela%'
    ORDER BY l.descricao, f.mes_referencia;
  `);
  
  console.log("=== LANÇAMENTOS PARCELADOS NO BANCO ===");
  res.rows.forEach(r => {
    console.log(`Fatura Ref: ${r.mes_referencia} | Desc: ${r.descricao} | Valor: R$ ${r.valor} | Transacao: ${r.data_transacao.toISOString().split('T')[0]}`);
  });
  
  await pgClient.end();
}

run().catch(err => {
  console.error("Erro:", err);
});
