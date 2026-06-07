const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    
    // Consulta o código fonte da função handle_new_message_update_conversation
    const res = await client.query("SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_message_update_conversation'");
    console.log("=== Código da função handle_new_message_update_conversation ===");
    console.log(res.rows[0]?.prosrc);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();
