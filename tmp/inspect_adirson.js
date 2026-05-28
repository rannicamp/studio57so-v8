const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- MENSAGENS ESPECÍFICAS DE ADIRSON CARLOS (5199) ---');

  // Buscar todas as mensagens com contato_id = 5199
  const msgsRes = await client.query(`
    SELECT id, contato_id, direction, status, sender_id, receiver_id, content, sent_at
    FROM whatsapp_messages
    WHERE contato_id = 5199
    ORDER BY sent_at DESC;
  `);

  console.log(`Mensagens encontradas para contato_id = 5199 (total: ${msgsRes.rows.length}):`);
  msgsRes.rows.forEach(r => {
    console.log(` - MSG ID: ${r.id} | Dir: ${r.direction} | Sender: "${r.sender_id}" | Receiver: "${r.receiver_id}" | Status: ${r.status}`);
    console.log(`   Content: "${r.content ? r.content.substring(0, 100) : 'null'}"`);
  });

  // Simular a função getCanonicalPhone
  const getCanonicalPhone = (phone) => {
    if (!phone) return null;
    let digits = String(phone).replace(/[^0-9]/g, '');
    let len = digits.length;
    if (len < 10) return digits;
    
    let core = digits.slice(-8); // últimos 8 dígitos
    let ddd;
    if (len % 2 !== 0) { // ímpares (tem 9º dígito): 11, 13
        ddd = digits.slice(-11, -9);
    } else { // pares (sem 9º dígito): 10, 12
        ddd = digits.slice(-10, -8);
    }
    return `${ddd}${core}`;
  };

  const headerPhone = '553384051443';
  const canonicalHeader = getCanonicalPhone(headerPhone);
  console.log(`\nSimulando filtro com headerPhone = "${headerPhone}" (Canonical: "${canonicalHeader}"):`);

  msgsRes.rows.forEach(r => {
    const canonicalSender = getCanonicalPhone(r.sender_id);
    const canonicalReceiver = getCanonicalPhone(r.receiver_id);
    const match = canonicalSender === canonicalHeader || canonicalReceiver === canonicalHeader;
    console.log(` - MSG ID: ${r.id} | Sender: "${r.sender_id}" (Canonical: "${canonicalSender}") | Receiver: "${r.receiver_id}" (Canonical: "${canonicalReceiver}") | MATCH: ${match}`);
  });

  await client.end();
}

main();
