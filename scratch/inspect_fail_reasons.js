const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Let's find Max
  const { data: contacts } = await supabase
    .from('contatos')
    .select('id, nome, ia_atendimento_ativo')
    .ilike('nome', '%Max%');

  console.log("=== Max Contacts found ===");
  console.log(contacts);

  // Rogerio Freitas (id: 6290)
  const rogerioId = 6290;
  
  // Fetch messages for Rogerio
  const { data: msgsRogerio } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('contato_id', rogerioId)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log("\n=== Rogerio Freitas (6290) Messages ===");
  msgsRogerio.forEach(m => {
    console.log(`[${m.created_at}] ${m.direction} (status: ${m.status}, error: ${m.error_message}): "${m.content}"`);
  });

  // Fetch CRM Notes for Rogerio
  const { data: notesRogerio } = await supabase
    .from('crm_notas')
    .select('*')
    .eq('contato_id', rogerioId)
    .order('created_at', { ascending: false });

  console.log("\n=== Rogerio Freitas CRM Notes ===");
  console.log(notesRogerio);

  // If we found Max's ID, fetch his info too
  const maxContact = contacts?.find(c => c.nome.toLowerCase() === 'max' || c.nome.includes('Max'));
  if (maxContact) {
    const maxId = maxContact.id;
    const { data: msgsMax } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contato_id', maxId)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log(`\n=== Max (${maxId}) Messages ===`);
    msgsMax.forEach(m => {
      console.log(`[${m.created_at}] ${m.direction} (status: ${m.status}, error: ${m.error_message}): "${m.content}"`);
    });

    const { data: notesMax } = await supabase
      .from('crm_notas')
      .select('*')
      .eq('contato_id', maxId)
      .order('created_at', { ascending: false });

    console.log(`\n=== Max CRM Notes ===`);
    console.log(notesMax);
  }
}

main();
