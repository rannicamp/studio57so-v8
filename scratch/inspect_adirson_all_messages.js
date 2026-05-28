const { Client } = require('pg');

const getCanonicalPhone = (phone) => {
  if (!phone) return null;
  let digits = String(phone).replace(/[^0-9]/g, '');
  let len = digits.length;
  if (len < 10) return digits;
  
  let core = digits.slice(-8);
  let ddd;
  if (len % 2 !== 0) {
      ddd = digits.slice(-11, -9);
  } else {
      ddd = digits.slice(-10, -8);
  }
  return `${ddd}${core}`;
};

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- BUSCANDO TODAS AS MENSAGENS DE WHATSAPP PARA O NÚMERO 3384051443 ---');

  // Buscar todas as mensagens que envolvam o número
  const res = await client.query(`
    SELECT id, contato_id, direction, sender_id, receiver_id, content, organizacao_id
    FROM whatsapp_messages
    WHERE sender_id LIKE '%3384051443%' OR receiver_id LIKE '%3384051443%';
  `);

  console.log(`Total de mensagens envolvidas: ${res.rows.length}`);
  
  // Agrupar por contato_id e organizacao_id
  const summary = {};
  res.rows.forEach(r => {
    const key = `Contato: ${r.contato_id} | Org: ${r.organizacao_id}`;
    if (!summary[key]) summary[key] = 0;
    summary[key]++;
  });

  console.log('Resumo de contagem por Contato e Organização:');
  console.log(summary);

  await client.end();
}

main().catch(console.error);
