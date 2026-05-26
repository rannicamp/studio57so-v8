const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- Contatos e Telefones ---');
  const telefones = await client.query("SELECT id, contato_id, telefone FROM telefones WHERE telefone LIKE '%5088629954%'");
  for (const t of telefones.rows) {
      console.log(`Tel ID: ${t.id}, Contato ID: ${t.contato_id}, Phone: ${t.telefone}`);
      const contato = await client.query("SELECT nome FROM contatos WHERE id = $1", [t.contato_id]);
      console.log(`   Nome: ${contato.rows[0]?.nome}`);
  }

  console.log('\n--- Conversas ---');
  const convs = await client.query("SELECT id, contato_id, phone_number FROM whatsapp_conversations WHERE phone_number LIKE '%5088629954%'");
  console.log(convs.rows);

  console.log('\n--- Mensagens ---');
  const msgs = await client.query("SELECT id, created_at, status, error_message, receiver_id, direction, content FROM whatsapp_messages WHERE receiver_id LIKE '%5088629954%' OR sender_id LIKE '%5088629954%' ORDER BY created_at DESC LIMIT 10");
  for (const m of msgs.rows) {
      console.log(`Msg ID: ${m.id} | Dir: ${m.direction} | Data: ${m.created_at} | Status: ${m.status} | Rec: ${m.receiver_id} | Err: ${m.error_message} | Content: ${m.content}`);
  }

  await client.end();
}

main();
