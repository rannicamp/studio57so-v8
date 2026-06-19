require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTable() {
  const { data, error } = await supabase.rpc('execute_sql', {
    query: `
      SELECT column_name, data_type, column_default, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'empreendimento_anexos';
    `
  });
  
  if (error) {
    // Se a RPC 'execute_sql' não estiver exposta via supabase-js (o que é comum por segurança),
    // vamos tentar uma query direta ou rodar via driver postgres.
    console.error('Erro na RPC execute_sql:', error);
    
    // Vamos fazer um select simples de teste de inserção
    console.log('Tentando selecionar 1 registro de empreendimento_anexos...');
    const { data: selectData, error: selectError } = await supabase
      .from('empreendimento_anexos')
      .select('*')
      .limit(1);
    
    if (selectError) {
      console.error('Erro ao selecionar:', selectError);
    } else {
      console.log('Estrutura de chaves de 1 registro:', Object.keys(selectData[0] || {}));
    }
  } else {
    console.log('Colunas de empreendimento_anexos:');
    console.table(data);
  }
}

checkTable();
