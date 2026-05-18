require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testQuery() {
  console.time('query');
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select(`
      *,
      contatos (
        id,
        nome,
        foto_url,
        tipo_contato,
        telefone_principal: telefones (telefone),
        funil: contatos_no_funil!contato_id (
          corretor_id,
          corretores: contatos!corretor_id(nome),
          coluna: colunas_funil (
            nome
          )
        )
      ),
      last_message: whatsapp_messages!last_message_id (
        content,
        created_at,
        status
      )
    `)
    .eq('organizacao_id', 2)
    .order('updated_at', { ascending: false });
  console.timeEnd('query');
  console.log('Error:', error);
  console.log('Count:', data?.length);
}

testQuery().catch(console.error);
