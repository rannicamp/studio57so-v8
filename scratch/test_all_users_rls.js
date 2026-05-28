const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- TESTANDO RLS PARA VÁRIOS USUÁRIOS DA ORG 2 ---');

  const users = [
    { name: 'Ranniere', id: '3bfde802-b916-4ea6-a871-7436481bfd3f' },
    { name: 'Ludimila Campos Marques', id: '61ac19bf-74ad-4b76-849a-9b244843c920' },
    { name: 'Ludimila (e48b)', id: 'e48b4e12-afa9-4672-b56b-45e5c9a8fd5a' },
    { name: 'Davi', id: '08bf9400-c2c2-4067-acbb-3a6720bc88eb' },
    { name: 'Alison Braga', id: 'eba9495e-28a3-481a-adc0-e2f186f86240' }
  ];

  for (const u of users) {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [u.id]);
    await client.query(`SELECT set_config('role', 'authenticated', true)`);

    const orgRes = await client.query(`SELECT get_auth_user_org() as org_id`);
    const orgId = orgRes.rows[0]?.org_id;

    const msgsRes = await client.query(`
      SELECT count(*) as count
      FROM whatsapp_messages
      WHERE contato_id = 5199;
    `);

    console.log(`User: ${u.name} (ID: ${u.id}) | get_auth_user_org(): ${orgId} | Mensagens retornadas: ${msgsRes.rows[0].count}`);
    await client.query('ROLLBACK');
  }

  await client.end();
}

main().catch(console.error);
