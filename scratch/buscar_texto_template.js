const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ 
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  try {
    // Buscar mensagens recentes enviadas que possam ser do template ou notas do CRM contendo o nome do template
    console.log("=== BUSCANDO MENSAGENS E NOTAS QUE MENCIONAM saudacao_entrada_v2 ===");
    
    const resNotes = await client.query(`
      SELECT conteudo, created_at 
      FROM public.crm_notas 
      WHERE conteudo ILIKE '%saudacao_entrada_v2%'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log("\nNotas do CRM encontradas:");
    resNotes.rows.forEach(r => {
      console.log(`[${r.created_at}] ${r.conteudo}`);
      console.log("-----------------------------------------");
    });

    const resMsgs = await client.query(`
      SELECT content, created_at 
      FROM public.whatsapp_messages 
      WHERE content ILIKE '%saudacao_entrada_v2%' OR content ILIKE '%Olá%Studio 57%' OR content ILIKE '%Olá%Elo 57%'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log("\nMensagens encontradas:");
    resMsgs.rows.forEach(r => {
      console.log(`[${r.created_at}] ${r.content}`);
      console.log("-----------------------------------------");
    });

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
