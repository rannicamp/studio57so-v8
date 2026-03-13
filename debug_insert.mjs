import pg from 'pg';

const { Client } = pg;
const client = new Client({
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  try {
    const res = await client.query(`
      INSERT INTO materiais (nome, unidade_medida, organizacao_id, classificacao) 
      VALUES ('Teste Bot Insert Insumo', 'un', 1, 'Insumo') 
      RETURNING *;
    `);
    console.log('Insert Sucesso:', res.rows[0].id);
    
    // Cleanup
    await client.query(`DELETE FROM materiais WHERE id = $1`, [res.rows[0].id]);
  } catch (err) {
    console.error('Insert Erro:', err.message);
  }
  await client.end();
}
run();
