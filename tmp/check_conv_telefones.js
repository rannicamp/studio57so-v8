const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- ANÁLISE DE VÍNCULO DE CONVERSAS COM TELEFONES ---');

  // 1. Contar conversas sem contato associado
  const resNoContact = await client.query(`
    SELECT count(*) as count 
    FROM whatsapp_conversations 
    WHERE contato_id IS NULL;
  `);
  console.log(`Conversas sem contato_id: ${resNoContact.rows[0].count}`);

  // 2. Contar conversas cujo contato não possui nenhum telefone na tabela telefones
  const resNoTel = await client.query(`
    SELECT count(*) as count 
    FROM whatsapp_conversations c
    LEFT JOIN telefones t ON t.contato_id = c.contato_id
    WHERE t.id IS NULL;
  `);
  console.log(`Conversas cujo contato não possui telefone cadastrado: ${resNoTel.rows[0].count}`);

  // 3. Amostra de conversas sem telefone correspondente
  const resNoTelSample = await client.query(`
    SELECT c.id, c.phone_number, c.contato_id
    FROM whatsapp_conversations c
    LEFT JOIN telefones t ON t.contato_id = c.contato_id
    WHERE t.id IS NULL
    LIMIT 10;
  `);
  if (resNoTelSample.rows.length > 0) {
    console.log('\nAmostra de conversas sem telefone cadastrado:');
    resNoTelSample.rows.forEach(r => {
      console.log(` - ID: ${r.id} | Phone: "${r.phone_number}" | Contato ID: ${r.contato_id}`);
    });
  }

  await client.end();
}

main();
