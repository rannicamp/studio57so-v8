const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    
    // 1. Funis da organização 2
    const resFunis = await client.query(`
      SELECT id, nome 
      FROM funis 
      WHERE organizacao_id = 2;
    `);
    console.log("=== Funis da Org 2 ===");
    console.table(resFunis.rows);
    
    // 2. Quantidade de leads de maio em cada funil
    const resCountFunil = await client.query(`
      SELECT 
        col.funil_id,
        f.nome as funil_nome,
        COUNT(DISTINCT cnf.id) as total_leads_no_funil
      FROM contatos_no_funil cnf
      INNER JOIN contatos c ON c.id::text = cnf.contato_id::text
      LEFT JOIN colunas_funil col ON col.id = cnf.coluna_id
      LEFT JOIN funis f ON f.id = col.funil_id
      WHERE cnf.organizacao_id = 2
        AND c.tipo_contato = 'Lead'
        AND c.created_at >= '2026-05-01 00:00:00-03'::timestamptz
        AND c.created_at <= '2026-05-31 23:59:59-03'::timestamptz
      GROUP BY col.funil_id, f.nome;
    `);
    console.log("\n=== Distribuicao de Leads de Maio por Funil ===");
    console.table(resCountFunil.rows);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();
