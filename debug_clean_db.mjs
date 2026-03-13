import pg from 'pg';

const { Client } = pg;
const client = new Client({
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT id, propriedade_nome, escopo, tipo_vinculo, material_id
    FROM bim_mapeamentos_propriedades 
    WHERE propriedade_nome ILIKE '%comprimento%' OR propriedade_nome ILIKE '%area%' OR propriedade_nome ILIKE '%volume%';
  `);
  console.log('Mapeamentos indevidos:', res.rows);
  
  if (res.rows.length > 0) {
    const ids = res.rows.map(r => r.id);
    await client.query(`DELETE FROM bim_mapeamentos_propriedades WHERE id = ANY($1::int[])`, [ids]);
    console.log(`Deletados ${ids.length} mapeamentos problemáticos!`);
  } else {
    console.log('Nenhum mapeamento problemático encontrado.');
  }
  await client.end();
}
run();
