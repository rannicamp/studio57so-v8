import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const payload = {
    to: '553391912291',
    type: 'template',
    templateName: 'iniciar_contato', 
    languageCode: 'en',
    components: [{type: 'body', parameters: [{type: 'text', text: 'Devonildo Testador'}]}],
    organizacao_id: 2
  };
  
  console.log("Disparando API local no mesmo formato do erro 11655...");
  const res = await fetch('http://localhost:3000/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
  });
  
  const data = await res.json();
  console.log(`Status HTTP: ${res.status}`);
  console.log(`Resposta:`, JSON.stringify(data));
  
  if (data.messages && data.messages[0]) {
      const msgId = data.messages[0].id;
      console.log("-> Mensagem ID retornado pela API:", msgId);
      
      // Vamos verificar a tabela a cada 1 seg pra ver a mutação de status
      for(let i=0; i<5; i++) {
          const { data: dbRow } = await supabase.from('whatsapp_messages').select('status, error_message').eq('message_id', msgId).single();
          console.log(`DB check ${i}: status=${dbRow?.status} error=${dbRow?.error_message}`);
          await new Promise(r => setTimeout(r, 1000));
      }
  } else {
      // Se não retornar ID, vamos checar a última msg inserida hj do 553391912291
      const { data: dbRow } = await supabase.from('whatsapp_messages').select('status, error_message').order('created_at', {ascending: false}).limit(1).single();
      console.log(`Sem ID no retorno. Ultima inserida no DB: status=${dbRow?.status} error=${dbRow?.error_message}`);
  }
}
test();
