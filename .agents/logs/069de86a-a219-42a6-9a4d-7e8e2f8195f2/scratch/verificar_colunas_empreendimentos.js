const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- Listando Tabelas do Banco de Dados ---');
  const resTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log(resTables.rows.map(r => r.table_name).join(', '));

  console.log('\n--- Buscando dados das colunas de texto/configuração dos Empreendimentos ---');
  const resRows = await client.query(`
    SELECT id, nome, prazo_entrega, indice_reajuste, dados_contrato, observacoes
    FROM empreendimentos;
  `);
  console.table(resRows.rows);

  await client.end();
}

main();
