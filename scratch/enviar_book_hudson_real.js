// scratch/enviar_book_hudson_real.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const HUDSON_PHONE = '5533988157890';
const CONTATO_ID = 6124;
const ORGANIZACAO_ID = 2;

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '690198827516149';
const WHATSAPP_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN;

async function run() {
  console.log("=== ENVIANDO BOOK DO BETA SUÍTES REAL PARA O HUDSON MOTA ===");

  if (!WHATSAPP_TOKEN) {
    console.error("Erro: WHATSAPP_SYSTEM_USER_TOKEN ausente.");
    return;
  }

  const pdfUrl = 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/book/Book_Investidor_Beta_Suites.pdf';
  const filename = 'Book Comercial - Beta Suítes.pdf';

  // 1. Fazer requisição direta para a API da Meta
  console.log(`Disparando requisição de documento para a Meta API...`);
  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: HUDSON_PHONE,
          type: 'document',
          document: {
            link: pdfUrl,
            caption: 'Olá, Hudson! Estou te enviando novamente o book oficial do Beta Suítes com todas as plantas e detalhes para você analisar melhor o projeto. 😊',
            filename: filename
          }
        })
      }
    );

    const metaData = await metaRes.json();
    console.log(`Status de retorno da Meta: ${metaRes.status} (${metaRes.statusText})`);
    console.log("Resposta da Meta:", JSON.stringify(metaData, null, 2));

    if (metaRes.ok && metaData.messages && metaData.messages[0]) {
      const messageId = metaData.messages[0].id;
      console.log(`Mensagem enviada com sucesso! Meta ID: ${messageId}`);

      // 2. Gravar o log da mensagem de sucesso no banco de dados
      console.log("Gravando registro de mensagem no banco...");
      const { error: dbError } = await supabase
        .from('whatsapp_messages')
        .insert({
          contato_id: CONTATO_ID,
          sender_id: WHATSAPP_PHONE_NUMBER_ID,
          receiver_id: HUDSON_PHONE,
          content: filename,
          direction: 'outbound',
          status: 'sent',
          message_id: messageId,
          organizacao_id: ORGANIZACAO_ID,
          media_url: pdfUrl
        });

      if (dbError) {
        console.error("Erro ao gravar mensagem no banco:", dbError.message);
      } else {
        console.log("Mensagem gravada com sucesso na tabela whatsapp_messages!");
      }

      // 3. Reativar o piloto automático da Stella para ele continuar o papo
      console.log("Reativando piloto automático da Stella para o Hudson...");
      const { error: errPiloto } = await supabase
        .from('contatos')
        .update({ ia_atendimento_ativo: true })
        .eq('id', CONTATO_ID);

      if (errPiloto) console.error("Erro ao reativar piloto:", errPiloto.message);
      else console.log("Piloto automático da Stella reativado!");

    } else {
      console.error("Erro no envio via Meta:", metaData.error?.message || 'Erro desconhecido');
    }
  } catch (err) {
    console.error("Erro na requisição:", err.message);
  }
}

run().catch(console.error);
