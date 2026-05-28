const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- CHECAGEM DE TELEFONES E COUNTRY CODE NAS CONVERSAS ---');

  // 1. Mostrar os primeiros 20 telefones da tabela whatsapp_conversations
  const res = await client.query(`
    SELECT id, phone_number, contato_id
    FROM whatsapp_conversations
    ORDER BY updated_at DESC
    LIMIT 20;
  `);

  console.log('Exemplos de whatsapp_conversations.phone_number:');
  res.rows.forEach(r => {
    console.log(` - ID: ${r.id} | Phone: "${r.phone_number}" | Contato ID: ${r.contato_id}`);
  });

  // 2. Tentar cruzar whatsapp_conversations com telefones e ver se batem os country_codes
  const resCross = await client.query(`
    SELECT 
      c.phone_number,
      t.telefone,
      t.country_code,
      c.contato_id
    FROM whatsapp_conversations c
    LEFT JOIN telefones t ON t.contato_id = c.contato_id
    ORDER BY c.updated_at DESC
    LIMIT 10;
  `);
  console.log('\nCruzamento whatsapp_conversations com telefones:');
  resCross.rows.forEach(r => {
    console.log(` - Conv Phone: "${r.phone_number}" | DB Phone: "${r.telefone}" | CC: "${r.country_code}"`);
  });

  await client.end();
}

main();
