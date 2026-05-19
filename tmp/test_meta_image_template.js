require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testTemplate() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: config } = await supabase.from('configuracoes_whatsapp').select('whatsapp_business_account_id').limit(1).single();
  const WABA_ID = config.whatsapp_business_account_id;
  const TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN;
  
  const payload = {
    name: "test_image_template_" + Date.now(),
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "HEADER",
        format: "IMAGE",
        // try with no example first
      },
      {
        type: "BODY",
        text: "Este é um teste com imagem."
      }
    ]
  };
  
  const res = await fetch(`https://graph.facebook.com/v20.0/${WABA_ID}/message_templates`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const data = await res.json();
  console.log("RESPONSE:", JSON.stringify(data, null, 2));
}

testTemplate();
