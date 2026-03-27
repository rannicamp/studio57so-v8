require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function getBugs() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data: feedbacks, error } = await supabase
      .from('feedback')
      .select('*')
      .in('status', ['Novo', 'Em Análise'])
      .or('diagnostico.is.null,diagnostico.eq.');

    if (error) throw error;
    if (!feedbacks || feedbacks.length === 0) {
      console.log("[]");
      return;
    }

    // Buscar nomes manualmente
    const userIds = [...new Set(feedbacks.map(f => f.user_id).filter(Boolean))];
    const orgIds = [...new Set(feedbacks.map(f => f.organizacao_id).filter(Boolean))];

    const { data: users } = await supabase.from('funcionarios').select('id, full_name').in('id', userIds);
    const { data: orgs } = await supabase.from('organizacao').select('id, empresa_root_id').in('id', orgIds);
    
    // Obter empresas roots
    const rootIds = [...new Set((orgs||[]).map(o => o.empresa_root_id).filter(Boolean))];
    const { data: emps } = await supabase.from('cadastro_empresa').select('id, razao_social').in('id', rootIds);

    const result = feedbacks.map(f => {
       const user = (users||[]).find(u => u.id === f.user_id) || {};
       const org = (orgs||[]).find(o => o.id === f.organizacao_id) || {};
       const emp = (emps||[]).find(e => e.id === org.empresa_root_id) || {};
       return {
         ...f,
         autor_nome: user.full_name || 'Desconhecido',
         org_nome: emp.razao_social || 'Desconhecida'
       }
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Erro:", err);
  }
}

getBugs();
