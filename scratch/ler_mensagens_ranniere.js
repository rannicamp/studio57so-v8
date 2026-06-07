const { Client } = require('pg');
async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== BUSCANDO MENSAGENS DO RANNIERE (ID 5598) EM 07/06/2026 ===");
  const res = await client.query(`
    SELECT id, content, direction, sent_at, created_at, status, nome_remetente
    FROM public.whatsapp_messages
    WHERE contato_id = 5598 AND created_at >= '2026-06-06 00:00:00-03' AND created_at <= '2026-06-07 08:38:00-03'
    ORDER BY created_at ASC
  `);
  
  res.rows.forEach(row => {
    console.log(`[${row.created_at}] [${row.direction}] Remetente: ${row.nome_remetente} (ID: ${row.id})`);
    console.log(`Conteúdo: ${row.content ? row.content.substring(0, 150) + '...' : 'null'}`);
    console.log("--------------------------------------------------");
  });

  await client.end();
}
run().catch(console.error);
