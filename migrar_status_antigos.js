require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Migrando status legados para o novo padrão do Kanban...");

  // 1. "Resolvido" -> "Implementado"
  const { data: d1, error: e1 } = await supabase
    .from('feedback')
    .update({ status: 'Implementado' })
    .in('status', ['Resolvido', 'resolvido']);
    
  if (e1) console.log("Erro ao migrar Resolvido:", e1.message);
  else console.log("Status 'Resolvido' alterado para 'Implementado'.");

  // 2. "Aberto" or NULL -> "Novo"
  const { data: d2, error: e2 } = await supabase
    .from('feedback')
    .update({ status: 'Novo' })
    .or('status.eq.Aberto,status.is.null');

  if (e2) console.log("Erro ao migrar Aberto/NULL:", e2.message);
  else console.log("Status 'Aberto' ou vazio alterado para 'Novo'.");

  // Fetching all again to display summary of Unsolved ones
  const { data: pendentes } = await supabase
    .from('feedback')
    .select('id, descricao, usuario:usuarios(nome), status')
    .in('status', ['Novo', 'Em Análise'])
    .order('created_at', { ascending: false });

  console.log(`\n\n=== FEEDBACKS PENDENTES (${pendentes.length}) ===`);
  pendentes.forEach(p => {
      console.log(`\n[#${p.id}] Status: ${p.status} | Autor: ${p.usuario?.nome || 'Anônimo'}`);
      console.log(`💬 "${p.descricao}"`);
  });
}
run();
