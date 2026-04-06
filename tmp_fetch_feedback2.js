require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function getFeedbacks() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  try {
    const { data: feedbacks, error } = await supabase
      .from('feedback')
      .select('*')
      .in('status', ['Novo', 'Em Análise']);
      
    if (error) throw error;
    
    const pendentes = feedbacks.filter(f => !f.diagnostico || f.diagnostico.trim() === '');
    
    // Enrich with Funcionario and Empresa names
    const enriched = await Promise.all(pendentes.map(async (f) => {
      let funcName = 'Desconhecido';
      let empName = 'Desconhecida';
      
      if (f.user_id) {
        const { data: func } = await supabase.from('funcionarios').select('full_name').eq('user_id', f.user_id).single();
        if (func) funcName = func.full_name;
      }
      
      if (f.organizacao_id) {
        const { data: emp } = await supabase.from('cadastro_empresa').select('razao_social').eq('id', f.organizacao_id).single();
        if (emp) empName = emp.razao_social;
      }
      
      return {
        ...f,
        funcionario_nome: funcName,
        organizacao_nome: empName
      };
    }));
    
    console.log(JSON.stringify(enriched, null, 2));
  } catch (err) {
    console.error('Error fetching feedbacks:', err);
  }
}

getFeedbacks();
