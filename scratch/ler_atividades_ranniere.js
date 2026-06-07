const { Client } = require('pg');
async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== BUSCANDO ATIVIDADES DO RANNIERE (ID 5598) ===");
  const res = await client.query(`
    SELECT id, nome, descricao, status, tipo_atividade, responsavel_texto, data_inicio_prevista, hora_inicio, created_at
    FROM public.activities
    WHERE contato_id = 5598
    ORDER BY created_at DESC
    LIMIT 20
  `);
  
  res.rows.forEach(row => {
    console.log(`ID: ${row.id} | Nome: ${row.nome}`);
    console.log(`Status: ${row.status} | Tipo: ${row.tipo_atividade} | Responsável: ${row.responsavel_texto}`);
    console.log(`Data Prevista: ${row.data_inicio_prevista} ${row.hora_inicio}`);
    console.log(`Criado em: ${row.created_at}`);
    console.log(`Descrição: ${row.descricao}`);
    console.log("--------------------------------------------------");
  });

  await client.end();
}
run().catch(console.error);
