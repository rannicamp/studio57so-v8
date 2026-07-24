const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const contatos = await client.query("SELECT id, nome, meta_form_data FROM contatos WHERE nome ILIKE '%Marcyana%'");
  console.log('Contatos:', contatos.rows);
  
  if (contatos.rows.length > 0) {
    const contatoId = contatos.rows[0].id;
    const telefones = await client.query('SELECT * FROM telefones WHERE contato_id = $1', [contatoId]);
    console.log('Telefones:', telefones.rows);
    
    const conv = await client.query('SELECT * FROM whatsapp_conversations WHERE contato_id = $1', [contatoId]);
    console.log('Conversas:', conv.rows);
    
    const msgs = await client.query('SELECT * FROM whatsapp_messages WHERE contato_id = $1 ORDER BY id DESC LIMIT 2', [contatoId]);
    console.log('Mensagens:', msgs.rows.map(m => ({ id: m.id, status: m.status, error: m.error_message })));
  }

  await client.end();
}
main();
