const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- BUSCANDO CONVERSAS DE ADIRSON NO BANCO ---');

  // Buscar conversas por telefone ou contato
  const resConv = await client.query(`
    SELECT id, phone_number, contato_id, organizacao_id, meta_wa_id, updated_at
    FROM whatsapp_conversations
    WHERE phone_number LIKE '%84051443%' OR contato_id IN (5474, 5199);
  `);

  resConv.rows.forEach(r => {
    console.log(`Conv ID: ${r.id} | Phone: "${r.phone_number}" | Contato ID: ${r.contato_id} | Meta WA ID: "${r.meta_wa_id}"`);
  });

  // Também verificar onde estão as mensagens unificadas ou duplicadas de telefones
  const resTels = await client.query(`
    SELECT id, contato_id, telefone, tipo
    FROM telefones
    WHERE contato_id IN (5474, 5199) OR telefone LIKE '%84051443%';
  `);
  console.log('\nTelefones cadastrados:');
  resTels.rows.forEach(r => {
    console.log(` - Tel ID: ${r.id} | Contato ID: ${r.contato_id} | Telefone: "${r.telefone}" | Tipo: "${r.tipo}"`);
  });

  await client.end();
}

main();
