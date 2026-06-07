const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== BUSCANDO DADOS DO RANNIERE ===");

  // Buscar por "Ranniere" no nome
  const res = await client.query(`
    SELECT id, nome, cpf, rg, regime_bens, conjuge_id, tipo_contato, organizacao_id
    FROM public.contatos
    WHERE nome ILIKE '%Ranniere%'
  `);

  console.log("Contatos encontrados:");
  console.log(res.rows);

  for (const contato of res.rows) {
    console.log(`\n--- Mensagens Recentes do Contato ID ${contato.id} ---`);
    const msgs = await client.query(`
      SELECT id, content, direction, created_at
      FROM public.whatsapp_messages
      WHERE contato_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [contato.id]);
    console.log(msgs.rows);
  }

  await client.end();
}

run().catch(console.error);
