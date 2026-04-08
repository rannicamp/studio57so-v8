import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDetails() {
  const { data: config } = await supabase.from('configuracoes_whatsapp').select('*').limit(1);
  console.log("Configurações WhatsApp:");
  if (config && config.length > 0) {
      console.log(`- Org ID: ${config[0].organizacao_id}`);
      console.log(`- Phone Number ID: ${config[0].whatsapp_phone_number_id}`);
      console.log(`- Token exists? ${!!config[0].whatsapp_permanent_token}`);
  } else {
      console.log("- Sem configuração!");
  }

  const { data: members } = await supabase
    .from('whatsapp_list_members')
    .select('contatos(id, nome, telefones(telefone))')
    .eq('lista_id', 8); // A lista do último broadcast
  
  console.log("\nMembros da lista 8:");
  if (members) {
      members.forEach((m, idx) => {
          console.log(`[${idx+1}] Nome: ${m.contatos?.nome} | Telefone do BD: ${m.contatos?.telefones?.[0]?.telefone}`);
      });
  }
}

checkDetails();
