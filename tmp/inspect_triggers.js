const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('=== TESTANDO INSERT COM NÚMERO INEXISTENTE NO BANCO ===');
  // Usamos um número fictício completo aleatório para garantir que não haja conversa correspondente
  const fakePhone = '553399999' + Math.floor(1000 + Math.random() * 9000);
  console.log(`Número fictício para teste: ${fakePhone}`);

  try {
    const insertRes = await client.query(`
      INSERT INTO whatsapp_messages (
        contato_id, message_id, sender_id, receiver_id,
        content, direction, status, raw_payload,
        sent_at, organizacao_id
      ) VALUES (
        5686, -- Matheus Henrique (usamos o contato id dele para fins de relacionamento básico)
        'test_auto_message_' || uuid_generate_v4(),
        '690198827516149',
        $1,
        '(Automação) Template: saudacao_entrada_v2',
        'outbound',
        'sent',
        '{"test": true}'::jsonb,
        now(),
        2
      ) RETURNING id;
    `, [fakePhone]);
    
    const newId = insertRes.rows[0].id;
    console.log('✅ SUCESSO! Insert com número inexistente funcionou. ID:', newId);
    
    // Buscar a conversa para ver se a trigger criou automaticamente
    const convRes = await client.query('SELECT * FROM whatsapp_conversations WHERE phone_number = $1', [fakePhone]);
    console.log('Conversa criada automaticamente pela trigger?', convRes.rows.length > 0 ? 'SIM' : 'NÃO');
    if (convRes.rows.length > 0) {
      console.log('Detalhes da conversa criada:', convRes.rows[0]);
    }

    // Deletar o registro de teste (limpeza em cascata / manual)
    // Primeiro limpamos a referência na conversa para evitar erro de FK
    await client.query('UPDATE whatsapp_conversations SET last_message_id = NULL WHERE phone_number = $1', [fakePhone]);
    await client.query('DELETE FROM whatsapp_messages WHERE id = $1', [newId]);
    await client.query('DELETE FROM whatsapp_conversations WHERE phone_number = $1', [fakePhone]);
    console.log('Limpeza concluída com sucesso.');

  } catch (err) {
    console.error('❌ ERRO NO INSERT:', err.message);
    console.error(err);
  }

  await client.end();
}

main().catch(console.error);
