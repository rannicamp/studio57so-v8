const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const phone = '18622476449';
  console.log('--- Contatos e Telefones ---');
  const telefones = await client.query("SELECT id, contato_id, telefone FROM telefones WHERE telefone LIKE '%8622476449%'");
  console.log(telefones.rows);

  console.log('\n--- Conversas ---');
  const convs = await client.query("SELECT id, contato_id, phone_number, is_window_open, window_expires_at FROM whatsapp_conversations WHERE phone_number LIKE '%8622476449%'");
  console.log(convs.rows);

  if (convs.rows.length > 0) {
      console.log('\n--- Mensagens ---');
      const msgs = await client.query("SELECT id, created_at, status, error_message, direction, message_type FROM whatsapp_messages WHERE conversation_record_id = $1 ORDER BY created_at DESC LIMIT 10", [convs.rows[0].id]);
      for (const m of msgs.rows) {
          console.log(`Msg ID: ${m.id} | Dir: ${m.direction} | Data: ${m.created_at} | Status: ${m.status} | Type: ${m.message_type} | Err: ${m.error_message}`);
      }
  }

  await client.end();
}

main();
