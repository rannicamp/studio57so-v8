const { Client } = require('pg');

const PG_CONN = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;

async function run() {
  const pgClient = new Client({
    connectionString: PG_CONN,
    ssl: { rejectUnauthorized: false }
  });
  await pgClient.connect();
  
  const res = await pgClient.query(`
    SELECT f.id, f.mes_referencia, c.nome as conta, f.data_vencimento
    FROM public.faturas_cartao f
    JOIN public.contas_financeiras c ON c.id = f.conta_id
    WHERE f.organizacao_id = 12
    ORDER BY c.nome, f.mes_referencia;
  `);
  
  console.log("=== DUE DATES OF FATURAS IN DATABASE ===");
  res.rows.forEach(r => {
    console.log(`Conta: ${r.conta} | Mes: ${r.mes_referencia} | Due Date: ${r.data_vencimento.toISOString().split('T')[0]}`);
  });
  
  await pgClient.end();
}

run().catch(err => {
  console.error("Erro:", err);
});
