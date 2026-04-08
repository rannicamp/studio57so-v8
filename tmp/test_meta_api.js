import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testApi() {
  const { data: config } = await supabase.from('configuracoes_whatsapp').select('*').limit(1).single();
  const token = process.env.WHATSAPP_SYSTEM_USER_TOKEN || config.whatsapp_permanent_token;
  const phoneNumberId = config.whatsapp_phone_number_id;

  const { formatarParaWhatsAppBR } = await import('../utils/phoneUtils.js');
  const phoneForMeta = formatarParaWhatsAppBR('5533999611209'); // Igor M. Alto

  const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneForMeta,
      type: 'template',
      template: {
          name: 'informativo_corretores_pre_beta',
          language: { code: 'pt_BR' }
      }
  };

  console.log("Enviando para Meta:", payload);

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
  });

  const resData = await response.json();
  console.log("Resposta Meta:", resData);
}

testApi();
