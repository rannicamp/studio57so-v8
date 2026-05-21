const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res1 = await client.query("SELECT id, contato_id, telefone FROM telefones WHERE telefone LIKE '551%' AND length(telefone) = 13");
  
  let fixedCount = 0;
  for (const t of res1.rows) {
      const isBRMobile = t.telefone[4] === '9';
      
      if (!isBRMobile) {
          const fixedPhone = t.telefone.substring(2);
          console.log(`Corrigindo Tel ID ${t.id} de ${t.telefone} para ${fixedPhone}`);
          
          await client.query("UPDATE telefones SET telefone = $1, country_code = '+1' WHERE id = $2", [fixedPhone, t.id]);
          
          try {
            await client.query("UPDATE whatsapp_conversations SET phone_number = $1 WHERE phone_number = $2", [fixedPhone, t.telefone]);
          } catch(e) {
            console.log(`Conversa já existe para ${fixedPhone}, ignorando update de conversa.`);
          }
          
          fixedCount++;
      }
  }

  console.log(`\nTotal de números dos EUA corrigidos: ${fixedCount}`);

  await client.end();
}

main();
