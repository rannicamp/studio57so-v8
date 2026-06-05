const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    
    // Consulta o código fonte da função registrar_movimentacao_funil
    const res = await client.query("SELECT prosrc FROM pg_proc WHERE proname = 'registrar_movimentacao_funil'");
    console.log("=== Código da função registrar_movimentacao_funil ===");
    console.log(res.rows[0]?.prosrc);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();
