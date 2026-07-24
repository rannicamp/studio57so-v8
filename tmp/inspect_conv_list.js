const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- VARREDURA DETALHADA DE CONVERSAS E CONTATOS ---');

  // Buscar todas as conversas que tenham nome do contato similar a "Adirson"
  const res = await client.query(`
    SELECT 
      c.id as conv_id,
      c.phone_number as conv_phone,
      c.contato_id as conv_contato_id,
      cont.nome as cont_nome,
      cont.id as cont_id,
      t.telefone as tel_telefone
    FROM whatsapp_conversations c
    LEFT JOIN contatos cont ON cont.id = c.contato_id
    LEFT JOIN telefones t ON t.contato_id = cont.id
    WHERE cont.nome ILIKE '%Adirson%' OR c.phone_number LIKE '%84051443%';
  `);

  res.rows.forEach(r => {
    console.log(`Conv ID: ${r.conv_id} | Conv Phone: "${r.conv_phone}" | Conv Contato ID: ${r.conv_contato_id}`);
    console.log(`  Contact ID: ${r.cont_id} | Name: "${r.cont_nome}" | Tel in DB: "${r.tel_telefone}"`);
  });

  await client.end();
}

main();
