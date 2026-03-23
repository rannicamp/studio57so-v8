require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
     console.log('Sem chaves do Supabase. Falhou.');
     return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('feedback')
    .select(`
        id, descricao, pagina, status, created_at, link_opcional, imagem_url,
        usuarios ( nome, sobrenome )
    `)
    .order('created_at', { ascending: false });

  if (error) {
     console.log("ERRO:", error.message);
  } else {
     console.log("=== FEEDBACKS REGISTRADOS NO SISTEMA ===");
     if (data.length === 0) {
         console.log("Nenhum feedback encontrado.");
     } else {
         data.forEach((fb, i) => {
             console.log(`\n[${i+1}] ID: #${fb.id} | Status: ${fb.status}`);
             console.log(`👤 Autor: ${fb.usuarios ? fb.usuarios.nome + ' ' + (fb.usuarios.sobrenome || '') : 'Anônimo'}`);
             console.log(`📝 Descrição: "${fb.descricao}"`);
             console.log(`📍 Tela Origem: ${fb.pagina || 'N/A'}`);
             if (fb.link_opcional) console.log(`🔗 Link: ${fb.link_opcional}`);
             if (fb.imagem_url) console.log(`🖼️ Print: ${fb.imagem_url}`);
             console.log(`📅 Data: ${new Date(fb.created_at).toLocaleString('pt-BR')}`);
         });
     }
  }
}
run();
