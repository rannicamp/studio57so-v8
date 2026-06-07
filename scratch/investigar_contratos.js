const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== LISTAGEM DE COLUNAS DE FUNIL ===");

  let res = await client.query(`
    SELECT cf.id, cf.nome, cf.ordem, cf.tipo_coluna, cf.descricao, f.nome as funil_nome, cf.organizacao_id
    FROM public.colunas_funil cf
    JOIN public.funis f ON cf.funil_id = f.id
    ORDER BY cf.organizacao_id, f.nome, cf.ordem
  `);

  res.rows.forEach(r => {
    console.log(`Org: ${r.organizacao_id} | Funil: ${r.funil_name || r.funil_nome} | Ordem: ${r.ordem} | Nome: ${r.nome} | Tipo: ${r.tipo_coluna}`);
    console.log(`  - ID: ${r.id}`);
    console.log(`  - Descrição: ${r.descricao || 'Sem descrição'}`);
    console.log("-----------------------------------------------------------------");
  });

  await client.end();
}

run().catch(err => {
  console.error("Erro na execução:", err);
});
