require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log("Aplicando resoluções ditadas pelo usuário...");

  // 1) Ticket #32 -> Implementado (Folha de Ponto já tinha resolvido)
  // 2) Ticket #20 e #14 (Painel de Atividades) -> Implementados
  const { error: e1 } = await supabase
    .from('feedback')
    .update({ status: 'Implementado' })
    .in('id', [32, 20, 14]);

  if (e1) console.error("Erro ao resolver tickets:", e1);
  else console.log("✔️ Tickets #32, #20 e #14 marcados como 'Implementado'.");

  // 3) Ticket #13 (Whatsapp Negrito) -> Em Análise
  const { error: e2 } = await supabase
    .from('feedback')
    .update({ status: 'Em Análise' })
    .eq('id', 13);
    
  if (e2) console.error("Erro ao colocar em Análise:", e2);
  else console.log("🔍 Ticket #13 movido para 'Em Análise' (será revisto depois).");

  // 4) Ticket #48 (Teste do Ranniere) -> Excluir
  const { error: e3 } = await supabase
    .from('feedback')
    .delete()
    .eq('id', 48);
    
  if (e3) console.error("Erro ao excluir ticket #48:", e3);
  else console.log("🗑️ Ticket #48 excluído com sucesso do banco de dados.");

}
run();
