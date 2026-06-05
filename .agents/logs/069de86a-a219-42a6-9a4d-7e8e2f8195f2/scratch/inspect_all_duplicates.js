const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- VARREDURA E ANÁLISE DE TODOS OS DUPLICADOS ---');

  const res = await client.query(`
    SELECT 
      telefone,
      organizacao_id,
      count(distinct contato_id) as total_contatos,
      array_agg(contato_id::text) as contato_ids
    FROM telefones
    GROUP BY telefone, organizacao_id
    HAVING count(distinct contato_id) > 1
    ORDER BY total_contatos DESC;
  `);

  console.log(`Encontrados ${res.rows.length} telefones duplicados.`);

  for (const row of res.rows) {
    console.log(`\nTelefone: ${row.telefone} | Org: ${row.organizacao_id} | Contatos: ${row.contato_ids.join(', ')}`);
    const contactRes = await client.query(`
      SELECT id, nome, origem, created_at
      FROM contatos
      WHERE id = ANY($1::bigint[])
    `, [row.contato_ids]);

    for (const c of contactRes.rows) {
      const msgRes = await client.query(`
        SELECT direction, count(*) as count
        FROM whatsapp_messages
        WHERE contato_id = $1
        GROUP BY direction
      `, [c.id]);

      const phoneRes = await client.query(`
        SELECT id, telefone, tipo
        FROM telefones
        WHERE contato_id = $1
      `, [c.id]);

      console.log(`  - Contato [${c.id}] Name: "${c.nome}" | Origem: "${c.origem}" | Created: ${c.created_at}`);
      console.log(`    Phones in DB: ${phoneRes.rows.map(p => `${p.telefone} (${p.tipo})`).join(', ')}`);
      console.log(`    Messages: ${msgRes.rows.map(m => `${m.direction}: ${m.count}`).join(', ') || 'Nenhuma'}`);
    }
  }

  await client.end();
}

main();
