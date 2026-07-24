const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const dataCorte = new Date();
  dataCorte.setDate(dataCorte.getDate() - 7);
  const dataCorteISO = dataCorte.toISOString();

  const STELLA_CONTACT_ID = 5792;
  const ORGANIZACAO_ID = 2;

  const { data: leadsFunil } = await supabase
    .from('contatos_no_funil')
    .select('contato_id, coluna_id')
    .eq('corretor_id', STELLA_CONTACT_ID)
    .eq('organizacao_id', ORGANIZACAO_ID);

  const idsFunil = (leadsFunil || []).map(l => l.contato_id);
  console.log(`Leads in funil assigned to Stella: ${idsFunil.length}`);

  const { data: contatos } = await supabase
    .from('contatos')
    .select('id, nome, ia_atendimento_ativo')
    .eq('organizacao_id', ORGANIZACAO_ID);

  const contatosStella = contatos.filter(c => idsFunil.includes(c.id) || c.ia_atendimento_ativo === true);
  console.log(`Contatos matching Stella (funil or active): ${contatosStella.length}`);

  const { data: mensagens } = await supabase
    .from('whatsapp_messages')
    .select('contato_id')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .gte('created_at', dataCorteISO);

  const msgContactIds = [...new Set(mensagens.map(m => m.contato_id).filter(Boolean))];
  console.log(`Unique contact IDs with messages in last 7 days: ${msgContactIds.length}`);

  // Check intersection
  const intersection = contatosStella.filter(c => msgContactIds.includes(c.id));
  console.log(`Active Stella contacts intersection: ${intersection.length}`);
  console.log("Active Stella contacts list:", intersection.map(c => ({ id: c.id, nome: c.nome })));
}

main();
