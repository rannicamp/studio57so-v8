import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const phoneId = '690198827516149';
  
  // 1. Restaurar Org 2 
  await supabase
    .from('configuracoes_whatsapp')
    .update({ whatsapp_phone_number_id: phoneId })
    .eq('organizacao_id', 2);
    
  // 2. Limpar Org 1 para não ter conflito e a Org 2 reinar absoluta!
  await supabase
    .from('configuracoes_whatsapp')
    .update({ whatsapp_phone_number_id: null })
    .eq('organizacao_id', 1);

  // 3. Mover as 5 mensagens de VOLTA para a Org 2
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const { data: msgs } = await supabase
    .from('whatsapp_messages')
    .update({ organizacao_id: 2 })
    .eq('organizacao_id', 1)
    .gte('created_at', today.toISOString());
    
  console.log("Desfeito: Whatsapp 100% da Org 2 e mensagens devolvidas para caixa da filial!");
}
fix();
