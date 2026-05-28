const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- SIMULANDO RLS PARA USUÁRIO RANNIERE (Org 2) ---');

  // Iniciamos uma transação
  await client.query('BEGIN');

  // Definimos as claims de autenticação do Supabase
  // O ID do usuário Ranniere Campos na Org 2 é '3bfde802-b916-4ea6-a871-7436481bfd3f'
  const userId = '3bfde802-b916-4ea6-a871-7436481bfd3f';
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
  await client.query(`SELECT set_config('role', 'authenticated', true)`);

  // Vamos testar se o get_auth_user_org() funciona
  const orgRes = await client.query(`SELECT get_auth_user_org() as org_id, auth.uid() as uid`);
  console.log('Dados de autenticação simulados:', orgRes.rows[0]);

  // Agora vamos rodar a query de mensagens que o front faz
  const msgsRes = await client.query(`
    SELECT id, content, organizacao_id, contato_id
    FROM whatsapp_messages
    WHERE contato_id = 5199;
  `);

  console.log(`Mensagens retornadas sob RLS para contato_id = 5199: ${msgsRes.rows.length}`);
  if (msgsRes.rows.length > 0) {
    console.log('Primeiras 3 mensagens:');
    console.log(msgsRes.rows.slice(0, 3));
  }

  await client.query('ROLLBACK');
  await client.end();
}

main().catch(console.error);
