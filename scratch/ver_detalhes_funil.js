const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    
    // 1. Funis e Colunas da Org 2
    const resColunas = await client.query(`
      SELECT 
        f.id as funil_id,
        f.nome as funil_nome,
        c.id as coluna_id,
        c.nome as coluna_nome,
        c.ordem
      FROM funis f
      INNER JOIN colunas_funil c ON c.funil_id = f.id
      WHERE f.organizacao_id = 2
      ORDER BY f.nome, c.ordem;
    `);
    console.log("=== Funis e Colunas da Org 2 ===");
    console.table(resColunas.rows);

    // 2. Leads por Coluna/Funil
    const resCountLeads = await client.query(`
      SELECT 
        f.nome as funil_nome,
        c.nome as coluna_nome,
        c.id as coluna_id,
        COUNT(cnf.id) as total_leads
      FROM contatos_no_funil cnf
      INNER JOIN colunas_funil c ON c.id = cnf.coluna_id
      INNER JOIN funis f ON f.id = c.funil_id
      WHERE cnf.organizacao_id = 2
      GROUP BY f.nome, c.nome, c.id
      ORDER BY f.nome, total_leads DESC;
    `);
    console.log("\n=== Total de Leads por Coluna/Funil ===");
    console.table(resCountLeads.rows);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();
