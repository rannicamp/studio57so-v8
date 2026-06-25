// check_teo.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== DIAGNÓSTICO DO LEAD TÉO (ID 6051) ===");

  // 1. Dados do contato
  const { data: contato, error: errC } = await supabase
    .from('contatos')
    .select('id, nome, ia_atendimento_ativo, objetivo, renda_familiar, fgts, organizacao_id')
    .eq('id', 6051)
    .single();

  if (errC) {
    console.error("Erro ao buscar contato:", errC);
  } else {
    console.log("Contato:", JSON.stringify(contato, null, 2));
  }

  // 2. Dados do funil (onde ele está posicionado no CRM)
  const { data: funil, error: errF } = await supabase
    .from('contatos_no_funil')
    .select(`
      id,
      coluna_id,
      organizacao_id,
      colunas_funil (
        id,
        nome,
        funil_id
      )
    `)
    .eq('contato_id', 6051)
    .maybeSingle();

  if (errF) {
    console.error("Erro ao buscar funil:", errF);
  } else {
    console.log("Posição no CRM:", JSON.stringify(funil, null, 2));
  }

  // 3. Notas do CRM cadastrados para ele
  const { data: notas, error: errN } = await supabase
    .from('crm_notas')
    .select('id, conteudo, created_at')
    .eq('contato_id', 6051)
    .order('created_at', { ascending: false });

  if (errN) {
    console.error("Erro ao buscar notas:", errN);
  } else {
    console.log("Notas do CRM:", JSON.stringify(notas, null, 2));
  }

  // 4. Mensagens do WhatsApp
  const { data: msgs, error: errM } = await supabase
    .from('whatsapp_messages')
    .select('id, direction, content, created_at, status')
    .eq('contato_id', 6051)
    .order('created_at', { ascending: true });

  if (errM) {
    console.error("Erro ao buscar mensagens:", errM);
  } else {
    console.log("=== HISTÓRICO DE MENSAGENS ===");
    msgs.forEach(m => {
      console.log(`[${m.created_at}] ${m.direction.toUpperCase()}: ${m.content} (Status: ${m.status})`);
    });
  }
}

main();
