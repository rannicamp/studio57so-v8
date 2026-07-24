const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('Atualizando a conversa da Monique (ID 5408)...');
  await client.query(`UPDATE whatsapp_conversations SET phone_number = '5511911351993' WHERE contato_id = 5408`);
  console.log('Banco atualizado.');
  
  await client.end();
}
main();
