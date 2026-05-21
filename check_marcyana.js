const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  const contatos = await client.query("SELECT id, nome FROM contatos WHERE nome ILIKE '%Marcyana%'");
  for (const c of contatos.rows) {
    const telefones = await client.query("SELECT telefone FROM telefones WHERE contato_id = $1", [c.id]);
    console.log(c.nome, telefones.rows);
  }

  await client.end();
}
main();
