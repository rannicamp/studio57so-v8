const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log("=== ENVIANDO MENSAGEM SIMULADA DA STELLA PARA RANNIERE ===");

  const contatoId = 5598; // RANNIERE CAMPOS MENDES
  const organizacaoId = 2; // Studio 57
  const conversationRecordId = 16948; // ID da conversa ativa (553391912291)
  const receiverId = '553391912291'; // Número do celular do Ranniere na conversa
  const senderId = '5531988888888'; // Número do remetente (Stella/WABA do sistema)

  // 1. Obter o maior ID atual de whatsapp_messages para gerar o próximo
  const resMaxId = await client.query(`SELECT COALESCE(MAX(id), 0) as max_id FROM public.whatsapp_messages`);
  const nextId = parseInt(resMaxId.rows[0].max_id) + 1;
  console.log(`Próximo ID de mensagem gerado: ${nextId}`);

  // 2. Texto da resposta da Stella
  const mensagemStella = `Ranniere, números na mesa! 📊🚀

Para o Apartamento 303 do Residencial Alfa (R$ 435.797,08), o plano fica assim:

• *Entrada (20%)*: R$ 87.159,42 (Vencimento em 3 dias úteis: 10/06/2026)
• *Mensais de Obra (40%)*: 36 parcelas de R$ 4.842,19
• *Saldo Remanescente (40%)*: R$ 174.318,83 (Chaves/Financiamento)

Ah! E um detalhe: no Residencial Alfa, a vaga de garagem está inclusa sem custo adicional na compra da unidade comercializada, mas você precisa escolher qual delas quer registrar no seu contrato.

As garagens *11, 14 e 20* estão disponíveis no Residencial Alfa! Você pode ver a numeração delas no book de vendas e escolher a sua de preferência. 

Qual delas você prefere deixar reservada junto com o apartamento? 🏢🚗`;

  // 3. Inserir a mensagem associando ao conversation_record_id, receiver_id e sender_id
  await client.query(`
    INSERT INTO public.whatsapp_messages (
      id, contato_id, conversation_record_id, content, direction, sent_at, status, is_read, organizacao_id, nome_remetente, receiver_id, sender_id
    )
    VALUES ($1, $2, $3, $4, 'outbound', now(), 'sent', true, $5, 'Stella IA', $6, $7)
  `, [nextId, contatoId, conversationRecordId, mensagemStella, organizacaoId, receiverId, senderId]);

  console.log("[OK] Mensagem simulada da Stella salva na tabela whatsapp_messages.");

  await client.end();
}

run().catch(console.error);
