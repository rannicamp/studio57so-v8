require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    const contactId = 5683; // Janice Castro
    console.log("=== DETALHES DE JANICE CASTRO ===");
    
    const { data: contact, error: errC } = await supabase
      .from('contatos')
      .select('*')
      .eq('id', contactId)
      .single();
    if (errC) throw errC;
    console.log("Contato:", {
      id: contact.id,
      nome: contact.nome,
      origem: contact.origem,
      meta_form_data: contact.meta_form_data,
      meta_lead_id: contact.meta_lead_id
    });

    const { data: telefones, error: errT } = await supabase
      .from('telefones')
      .select('*')
      .eq('contato_id', contactId);
    if (errT) throw errT;
    console.log("Telefones:", telefones);

  } catch (e) {
    console.error("Erro:", e);
  }
}

run();
