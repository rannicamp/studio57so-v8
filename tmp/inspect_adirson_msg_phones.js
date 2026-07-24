const { Client } = require('pg');

const getCanonicalPhone = (phone) => {
  if (!phone) return null;
  let digits = String(phone).replace(/[^0-9]/g, '');
  let len = digits.length;
  if (len < 10) return digits; // Fallback se for muito curto
  
  let core = digits.slice(-8); // últimos 8 dígitos
  let ddd;
  if (len % 2 !== 0) { // ímpares (tem 9º dígito): 11, 13
      ddd = digits.slice(-11, -9);
  } else { // pares (sem 9º dígito): 10, 12
      ddd = digits.slice(-10, -8);
  }
  return `${ddd}${core}`;
};

async function main() {
  const client = new Client({ 
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- ANÁLISE DE MATCH CANÔNICO PARA ADIRSON ---');

  const res = await client.query(`
    SELECT id, sender_id, receiver_id, content
    FROM whatsapp_messages
    WHERE contato_id = 5199
    ORDER BY id ASC;
  `);

  res.rows.forEach(r => {
    const sCan = getCanonicalPhone(r.sender_id);
    const rCan = getCanonicalPhone(r.receiver_id);
    console.log(`ID: ${r.id}`);
    console.log(`  Sender: "${r.sender_id}" -> Canonical: "${sCan}"`);
    console.log(`  Receiver: "${r.receiver_id}" -> Canonical: "${rCan}"`);
  });

  await client.end();
}

main();
