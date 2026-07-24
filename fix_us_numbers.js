const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res1 = await client.query("SELECT id, contato_id, telefone FROM telefones WHERE telefone LIKE '551%' AND length(telefone) = 13");
  
  let fixedCount = 0;
  for (const t of res1.rows) {
      // 55 [1] [X] [Y] ... 
      // Se fosse celular do Brasil: 55 11 9XXXX XXXX -> t.telefone[4] === '9'
      const isBRMobile = t.telefone[4] === '9';
      
      if (!isBRMobile) {
          // É um número dos EUA que foi salvo como 551...
          const fixedPhone = t.telefone.substring(2); // Remove o '55'
          console.log(`Corrigindo Tel ID ${t.id} de ${t.telefone} para ${fixedPhone}`);
          
          await client.query("UPDATE telefones SET telefone = $1, country_code = '+1' WHERE id = $2", [fixedPhone, t.id]);
          
          // Se houver uma conversa no whatsapp com esse número mangled, também consertar:
          await client.query("UPDATE whatsapp_conversations SET phone_number = $1 WHERE phone_number = $2", [fixedPhone, t.telefone]);
          
          fixedCount++;
      }
  }

  console.log(`\nTotal de números dos EUA corrigidos: ${fixedCount}`);

  await client.end();
}

main();
