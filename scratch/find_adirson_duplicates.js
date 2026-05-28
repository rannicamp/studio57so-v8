const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- BUSCANDO CONTATOS DE ADIRSON E TELEFONES ---');

  const resContatos = await client.query(`
    SELECT id, nome, organizacao_id
    FROM contatos
    WHERE nome ILIKE '%adirson%' OR id IN (
      SELECT contato_id FROM telefones WHERE telefone LIKE '%3384051443%'
    );
  `);

  console.log('Contatos encontrados:');
  console.log(resContatos.rows);

  const resTelefones = await client.query(`
    SELECT *
    FROM telefones
    WHERE telefone LIKE '%3384051443%' OR contato_id = 5199;
  `);

  console.log('\nTelefones encontrados:');
  console.log(resTelefones.rows);

  await client.end();
}

main().catch(console.error);
