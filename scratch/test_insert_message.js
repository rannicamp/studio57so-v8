const { Client } = require('pg');
async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  console.log("=== INICIANDO TESTE DE INSERT ===");
  try {
    await client.query("BEGIN");
    
    // Tenta inserir uma mensagem simples para o contato Ranniere
    const resMaxId = await client.query(`SELECT COALESCE(MAX(id), 0) as max_id FROM public.whatsapp_messages`);
    const nextId = parseInt(resMaxId.rows[0].max_id) + 1;
    
    const contatoId = 5598;
    const conversationRecordId = 16948;
    const receiverId = '553391912291';
    const senderId = '5531988888888';
    
    console.log(`Testando insert com id: ${nextId}`);
    
    const insertRes = await client.query(`
      INSERT INTO public.whatsapp_messages (
        id, contato_id, conversation_record_id, content, direction, sent_at, status, is_read, organizacao_id, nome_remetente, receiver_id, sender_id
      )
      VALUES ($1, $2, $3, $4, 'outbound', now(), 'sent', true, 2, 'Stella IA', $5, $6)
      RETURNING *
    `, [nextId, contatoId, conversationRecordId, "Mensagem de teste de inserção", receiverId, senderId]);
    
    console.log("Inserção bem-sucedida! Registro retornado:", insertRes.rows[0]);
    
    await client.query("ROLLBACK");
  } catch (err) {
    console.error("Erro capturado durante o insert:", err);
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
}
run().catch(console.error);
