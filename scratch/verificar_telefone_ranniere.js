const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== CHECK TELEFONE E CONVERSAS DO RANNIERE ===");

  const contatoId = 5598;

  // 1. Ver telefones
  const resTels = await client.query(`SELECT * FROM public.telefones WHERE contato_id = $1`, [contatoId]);
  console.log("Telefones do Ranniere:");
  console.log(resTels.rows);

  // 2. Ver conversas de WhatsApp
  const resConv = await client.query(`SELECT * FROM public.whatsapp_conversations WHERE contato_id = $1`, [contatoId]);
  console.log("Conversas de WhatsApp:");
  console.log(resConv.rows);

  await client.end();
}

run().catch(console.error);
