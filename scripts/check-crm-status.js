const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_CONTACT_ID = 5923; // ID do contato de Ranniere

async function checkCRM() {
  console.log('=== VERIFICANDO DADOS NO CRM PARA O LEAD ===');

  // 1. Verificar dados do contato
  const { data: contato } = await supabase
    .from('contatos')
    .select('nome, ia_atendimento_ativo, renda_familiar, fgts, mais_de_3_anos_clt, city, ai_analysis')
    .eq('id', TEST_CONTACT_ID)
    .single();

  console.log('Ficha Cadastral Atualizada no CRM:', contato);

  // 2. Verificar coluna no funil
  const { data: funil } = await supabase
    .from('contatos_no_funil')
    .select(`
      id,
      coluna_id,
      corretor_id,
      colunas_funil(id, nome)
    `)
    .eq('contato_id', TEST_CONTACT_ID)
    .maybeSingle();

  console.log('\nColuna no Funil:', {
    coluna_id: funil?.coluna_id,
    coluna_nome: funil?.colunas_funil?.nome,
    corretor_id: funil?.corretor_id
  });

  // 3. Verificar notas do CRM
  console.log('\n=== NOTAS DO CRM ===');
  const { data: notas } = await supabase
    .from('crm_notas')
    .select('conteudo, created_at')
    .eq('contato_id', TEST_CONTACT_ID)
    .order('created_at', { ascending: false });

  if (notas && notas.length > 0) {
    notas.forEach(n => {
      console.log(`[${new Date(n.created_at).toLocaleString('pt-BR')}] Nota:\n${n.conteudo}\n----------------------------------`);
    });
  } else {
    console.log('Nenhuma nota cadastrada.');
  }
}

checkCRM().catch(console.error);
