require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  const { data: tickets, error } = await supabase
      .from('feedback')
      .select('id, descricao, pagina, status, usuario_id, imagem_url, diagnostico, organizacao_id, created_at')
      .in('status', ['Novo', 'Em Análise']);
      
  if (error) {
      console.error('Error fetching feedbacks:', error);
      return;
  }
  
  const triagemTickets = tickets.filter(t => !t.diagnostico || t.diagnostico.trim() === '');
  console.log(`\n\n=== TICKETS PARA TRIAGEM: ${triagemTickets.length} ===`);
  
  if (triagemTickets.length > 0) {
      // Para cada ticket, vamos buscar os nomes do usuario e organizacao
      const userIds = [...new Set(triagemTickets.map(t => t.usuario_id).filter(Boolean))];
      const orgIds = [...new Set(triagemTickets.map(t => t.organizacao_id).filter(Boolean))];
      
      let usersMap = {};
      let orgsMap = {};
      
      if (userIds.length > 0) {
          const { data: users } = await supabase.from('funcionarios').select('auth_user_id, nome').in('auth_user_id', userIds);
          if (users) users.forEach(u => usersMap[u.auth_user_id] = u.nome);
      }
      
      if (orgIds.length > 0) {
          const { data: orgs } = await supabase.from('cadastro_empresa').select('id, nome_fantasia').in('id', orgIds);
          if (orgs) orgs.forEach(o => orgsMap[o.id] = o.nome_fantasia);
      }
      
      const ticketsEnriquecidos = triagemTickets.map(t => ({
          ...t,
          autor_nome: usersMap[t.usuario_id] || 'Desconhecido',
          organizacao_nome: orgsMap[t.organizacao_id] || 'Matriz Elo57'
      }));
      
      const fs = require('fs');
      fs.writeFileSync('tickets_para_triagem.json', JSON.stringify(ticketsEnriquecidos, null, 2));
      console.log('Resultados salvos em tickets_para_triagem.json');
      console.log(ticketsEnriquecidos);
      
  } else {
      console.log('Todos os tickets Ativos já têm diagnóstico.');
  }
}

run().catch(console.error);
