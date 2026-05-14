const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: config } = await supabase
    .from('configuracoes_whatsapp')
    .select('whatsapp_permanent_token, whatsapp_business_account_id')
    .eq('organizacao_id', 1)
    .single();

  const WHATSAPP_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || config.whatsapp_permanent_token;
  const WHATSAPP_BUSINESS_ACCOUNT_ID = config.whatsapp_business_account_id;

  const payload = {
    name: 'recebimento_cadastro_v6',
    category: 'MARKETING',
    language: 'pt_BR',
    components: [
      {
        type: 'BODY',
        text: 'Olá {{1}}, tudo bem? 🌟 Passando para confirmar que recebemos o seu cadastro com sucesso!\n\nUm dos nossos especialistas da Studio 57 Arquitetura e Incorporação já foi notificado e entrará em contato por aqui mesmo em instantes para entender o que você procura e tirar todas as suas dúvidas. Até logo!',
        example: {
          body_text: [
            ['Exemplo1']
          ]
        }
      }
    ]
  };

  console.log("Sending payload:", JSON.stringify(payload, null, 2));

  const url = `https://graph.facebook.com/v20.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;

  const apiResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`
    },
    body: JSON.stringify(payload)
  });

  const responseData = await apiResponse.json();
  console.log("Response:", JSON.stringify(responseData, null, 2));
}

run().catch(console.error);
