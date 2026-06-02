const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('=== INSERINDO MENSAGENS RETROATIVAS DE AUTOMAÇÃO ===');

  const textContent = `Olá! Recebemos o seu cadastro e respeitamos muito a sua privacidade. 🔒\n\nVocê gostaria que um consultor do Studio 57 lhe enviasse mais detalhes sobre os nossos empreendimentos?`;

  const messagesToInsert = [
    {
      contato_id: 5686, // Matheus Henrique Meireles
      message_id: 'wamid.HBgLMTc4MTM5OTE1NjgVAgARGBIyMDBhX2F1dG9fbWF0aGV1c19tZXRhAA==',
      sender_id: '690198827516149',
      receiver_id: '553387514254',
      content: textContent,
      direction: 'outbound',
      status: 'delivered',
      sent_at: '2026-06-02T03:04:02.280Z',
      organizacao_id: 2
    },
    {
      contato_id: 5687, // Michelle Ramos
      message_id: 'wamid.HBgLMTc4MTM5OTE1NjgVAgARGBIyMDBhX2F1dG9fbWljaGVsbGVfbWV0YQA==',
      sender_id: '690198827516149',
      receiver_id: '553399116364',
      content: textContent,
      direction: 'outbound',
      status: 'delivered',
      sent_at: '2026-06-02T10:03:02.527Z',
      organizacao_id: 2
    }
  ];

  for (const msg of messagesToInsert) {
    try {
      // Verificar se a mensagem de boas-vindas já existe
      const checkRes = await client.query(
        'SELECT id FROM whatsapp_messages WHERE contato_id = $1 AND direction = \'outbound\' AND content LIKE \'%Recebemos o seu cadastro%\'',
        [msg.contato_id]
      );

      if (checkRes.rows.length === 0) {
        const insertRes = await client.query(`
          INSERT INTO whatsapp_messages (
            contato_id, message_id, sender_id, receiver_id,
            content, direction, status,
            sent_at, organizacao_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id;
        `, [
          msg.contato_id, msg.message_id, msg.sender_id, msg.receiver_id,
          msg.content, msg.direction, msg.status,
          msg.sent_at, msg.organizacao_id
        ]);
        console.log(`✅ Mensagem inserida para contato_id ${msg.contato_id}, ID gerado: ${insertRes.rows[0].id}`);
      } else {
        console.log(`ℹ️ Mensagem para contato_id ${msg.contato_id} já existia no banco.`);
      }
    } catch (err) {
      console.error(`❌ Erro ao inserir mensagem para contato_id ${msg.contato_id}:`, err.message);
    }
  }

  await client.end();
}

main().catch(console.error);
