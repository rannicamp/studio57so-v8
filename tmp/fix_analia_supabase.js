require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO FATAL: Chaves do Supabase não encontradas.");
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Conectado ao Supabase API.");

  // 1. Procurar Analia nos contatos
  const { data: contatos, error: cErr } = await supabase
    .from('contatos')
    .select('id, nome')
    .ilike('nome', '%analia%');
    
  if (cErr) {
    console.error("Erro ao buscar contatos:", cErr);
    return;
  }
  
  console.log("Contatos Analia encontrados:", contatos);
  if (contatos.length === 0) {
      console.log("Nenhuma Analia encontrada nos contatos.");
      return;
  }
  
  const analiaContatoId = contatos[0].id;
  
  // 2. Procurar Analia nos usuários
  const { data: usuarios, error: uErr } = await supabase
    .from('usuarios')
    .select('id, nome, sobrenome, contato_id')
    .ilike('nome', '%analia%');
    
  if (uErr) {
    console.error("Erro ao buscar usuarios:", uErr);
    return;
  }
  
  console.log("Usuários Analia encontrados:", usuarios);
  
  if (usuarios.length > 0) {
      const analiaUsuarioId = usuarios[0].id;
      if (usuarios[0].contato_id !== analiaContatoId) {
          console.log(`Atualizando usuario Analia para apontar para o contato_id = ${analiaContatoId}`);
          const { error: updErr } = await supabase
              .from('usuarios')
              .update({ contato_id: analiaContatoId })
              .eq('id', analiaUsuarioId);
          if (updErr) console.error("Erro ao atualizar usuario:", updErr);
      } else {
          console.log("Usuário já está vinculado corretamente.");
      }
  }
  
  // 3. Atualizar cartões (contatos_no_funil) vazios para a Analia
  const { data: cardsVazios, error: pGetErr } = await supabase
    .from('contatos_no_funil')
    .select('id')
    .is('corretor_id', null);
    
  if (pGetErr) {
    console.error("Erro ao buscar cards vazios:", pGetErr);
    return;
  }
  
  console.log(`Cards sem corretor encontrados: ${cardsVazios.length}`);
  
  if (cardsVazios.length > 0) {
      const { data: updateCards, error: pErr } = await supabase
        .from('contatos_no_funil')
        .update({ corretor_id: analiaContatoId })
        .is('corretor_id', null)
        .select();
        
      if (pErr) {
        console.error("Erro ao atualizar cards:", pErr.message || JSON.stringify(pErr));
        return;
      }
      
      console.log(`Cards (contatos_no_funil) sem corretor agora atribuídos à Analia: ${updateCards.length}`);
  }
}

run();
