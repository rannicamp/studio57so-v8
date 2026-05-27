const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    const res = await client.query("SELECT prosrc FROM pg_proc WHERE proname = 'get_radar_stats'");
    const src = res.rows[0]?.prosrc;
    if (src) {
      fs.writeFileSync('scratch/full_radar.sql', src);
      console.log('Função salva com sucesso em scratch/full_radar.sql');
    } else {
      console.log('Função não encontrada');
    }
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();
