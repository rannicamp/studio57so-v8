const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    
    // Contagem de leads totais em maio
    const resTotal = await client.query(`
      SELECT COUNT(*) as total 
      FROM contatos 
      WHERE organizacao_id = 2 
        AND tipo_contato = 'Lead'
        AND created_at >= '2026-05-01 00:00:00-03'::timestamptz
        AND created_at <= '2026-05-31 23:59:59-03'::timestamptz;
    `);
    console.log("Total de leads criados em contatos em maio de 2026:", resTotal.rows[0].total);
    
    // Contagem de leads criados em maio que estão na tabela contatos_no_funil
    const resNoFunil = await client.query(`
      SELECT COUNT(*) as total 
      FROM contatos_no_funil cnf
      INNER JOIN contatos c ON c.id::text = cnf.contato_id::text
      WHERE cnf.organizacao_id = 2 
        AND c.tipo_contato = 'Lead'
        AND c.created_at >= '2026-05-01 00:00:00-03'::timestamptz
        AND c.created_at <= '2026-05-31 23:59:59-03'::timestamptz;
    `);
    console.log("Total de leads de maio em contatos_no_funil:", resNoFunil.rows[0].total);
    
    // Vamos listar os leads que estão no funil criados em maio
    const resList = await client.query(`
      SELECT 
        cnf.id as cnf_id,
        cnf.contato_id,
        c.nome as lead_nome,
        col.nome as coluna_nome,
        c.created_at
      FROM contatos_no_funil cnf
      INNER JOIN contatos c ON c.id::text = cnf.contato_id::text
      LEFT JOIN colunas_funil col ON col.id = cnf.coluna_id
      WHERE cnf.organizacao_id = 2 
        AND c.tipo_contato = 'Lead'
        AND c.created_at >= '2026-05-01 00:00:00-03'::timestamptz
        AND c.created_at <= '2026-05-31 23:59:59-03'::timestamptz;
    `);
    console.log("\nLista de todos os leads de maio em contatos_no_funil:");
    console.table(resList.rows);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();
