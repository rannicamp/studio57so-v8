const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  console.log('=== VERIFICANDO TEMPLATES DE WHATSAPP NO BANCO ===\n');

  const client = new Client({ 
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();

    // Buscar especificamente o template saudacao_entrada_v2 ou listar todos da org 2
    const { rows } = await client.query(`
      SELECT id, name, content, description, active, created_at
      FROM public.sys_notification_templates
      WHERE name LIKE '%saudacao_entrada%' OR name = 'saudacao_entrada_v2' OR (channel = 'whatsapp' AND (organizacao_id = 2 OR organizacao_id = 1))
    `);
    
    console.log("Templates Encontrados:");
    console.log(JSON.stringify(rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
