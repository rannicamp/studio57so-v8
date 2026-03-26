import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  // 1. Remove conflict from Org 2 (just clear the phone id to avoid breaking the config completely)
  const { error: updErr } = await supabase
    .from('configuracoes_whatsapp')
    .update({ whatsapp_phone_number_id: null })
    .eq('organizacao_id', 2);
  
  if (updErr) console.error("Erro ao atualizar config Org 2:", updErr);
  else console.log("✔️ Conflito de Phone ID resolvido. Org 2 foi desvinculada do número.");

  // 2. Mover as mensagens perdidas de hoje (Org 2) de volta para a Org 1
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const { data: msgs, error: selErr } = await supabase
    .from('whatsapp_messages')
    .select('id, organizacao_id, direction, created_at')
    .eq('organizacao_id', 2)
    .gte('created_at', today.toISOString());

  if (selErr) console.error("Erro buscando msgs perdidas:", selErr);
  else {
    console.log(`Encontradas ${msgs.length} mensagens perdidas na Org 2 de hoje.`);
    if (msgs.length > 0) {
      const { error: fixErr } = await supabase
        .from('whatsapp_messages')
        .update({ organizacao_id: 1 })
        .eq('organizacao_id', 2)
        .gte('created_at', today.toISOString());
      if (fixErr) console.error("Erro ao mover mensagens:", fixErr);
      else console.log("✔️ Todas as mensagens perdidas foram movidas de volta para a Matriz (Org 1).");
    }
  }
}

fix();
