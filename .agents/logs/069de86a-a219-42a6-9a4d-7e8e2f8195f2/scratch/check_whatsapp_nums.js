const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  const query = `
    SELECT id, phone_number_id, phone_number, business_account_id, organizacao_id FROM configuracoes_whatsapp;
  `;

  try {
      const res = await client.query(query);
      console.log('CONFIGURACOES WHATSAPP:');
      console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
      console.error('Erro:', e);
  }

  await client.end();
}

main();
