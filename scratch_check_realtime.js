// scratch_check_realtime.js
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runSQL() {
  const password = 'Srbr19010720@';
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;

  const connStr = `postgres://postgres:${encodeURIComponent(password)}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr });
  
  try {
     console.log("Estabelecendo conexão P2P com Supabase...");
     await client.connect();
     
     console.log("\n1️⃣ Verificando tabelas publicadas no Realtime:");
     const resCheck = await client.query(
       "SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('instagram_conversations', 'instagram_messages', 'whatsapp_conversations', 'whatsapp_messages')"
     );
     console.log(resCheck.rows);

     console.log("\n2️⃣ Ativando o Realtime para as tabelas do Instagram...");
     
     // Habilita individualmente para evitar erros caso uma já esteja habilitada
     const tables = ['instagram_conversations', 'instagram_messages'];
     for (const table of tables) {
       const alreadyInPub = resCheck.rows.some(r => r.tablename === table);
       if (!alreadyInPub) {
         console.log(`Adicionando ${table} ao realtime...`);
         await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE ${table}`);
       } else {
         console.log(`${table} já está publicada no Realtime!`);
       }
     }
     
     console.log("\n3️⃣ Verificação pós-ativação:");
     const resCheckFinal = await client.query(
       "SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('instagram_conversations', 'instagram_messages')"
     );
     console.log(resCheckFinal.rows);

     console.log("\nOperação SQL homologada com sucesso!");
  } catch(e) {
     console.error("FALHA NA QUERY SQL:", e.message);
  } finally {
     await client.end();
  }
}

runSQL();
