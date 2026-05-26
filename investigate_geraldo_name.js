const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  const contatos = await client.query("SELECT id, nome FROM contatos WHERE nome ILIKE '%Geraldo%'");
  for (const c of contatos.rows) {
      const telefones = await client.query("SELECT telefone FROM telefones WHERE contato_id = $1", [c.id]);
      console.log(`Contato: ${c.nome} (ID: ${c.id}) -> Telefones: ${telefones.rows.map(t => t.telefone).join(', ')}`);
      
      const convs = await client.query("SELECT id, phone_number FROM whatsapp_conversations WHERE contato_id = $1", [c.id]);
      for (const conv of convs.rows) {
          console.log(`   Conv: ${conv.phone_number}`);
          const msgs = await client.query("SELECT id, status, created_at, error_message FROM whatsapp_messages WHERE conversation_record_id = $1 ORDER BY created_at DESC LIMIT 3", [conv.id]);
          console.log(`     Msgs: ${JSON.stringify(msgs.rows)}`);
      }
  }

  await client.end();
}
main();
