const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_CONTACT_ID = 5923; // ID do contato de teste (Ranniere Campos)
const STELLA_CONTACT_ID = 5792; // ID do contato da Stella na Org 2
const COLUNA_ATENDIMENTO_ID = '029c8d6a-4799-4f4b-a55e-b4d5426718c0'; // EM ATENDIMENTO

async function reactivateLead() {
  console.log(`=== REATIVANDO LEAD DO RANNIERE DE ONDE PAROU ===`);

  // 1. Reativar piloto automático e limpar notas de transbordo recentes para simular continuidade
  const { error: resetContactError } = await supabase
    .from('contatos')
    .update({
      ia_atendimento_ativo: true
    })
    .eq('id', TEST_CONTACT_ID);

  if (resetContactError) {
    console.error('Erro ao reativar piloto automático:', resetContactError.message);
  } else {
    console.log('Piloto automático reativado!');
  }

  // 2. Mover de volta para EM ATENDIMENTO e atribuir à Stella
  const { data: funil } = await supabase
    .from('contatos_no_funil')
    .select('id')
    .eq('contato_id', TEST_CONTACT_ID)
    .limit(1)
    .maybeSingle();

  if (funil) {
    const { error: updateFunilError } = await supabase
      .from('contatos_no_funil')
      .update({
        coluna_id: COLUNA_ATENDIMENTO_ID,
        corretor_id: STELLA_CONTACT_ID
      })
      .eq('id', funil.id);

    if (updateFunilError) {
      console.error('Erro ao atualizar funil:', updateFunilError.message);
    } else {
      console.log('Lead movido de volta para EM ATENDIMENTO e atribuído à Stella!');
    }
  }

  // 3. Deletar a nota de transbordo recente e de handoff para que não poluam a IA na leitura do histórico
  console.log('3. Limpando nota de CRM de transbordo recente...');
  const { error: delNotasError } = await supabase
    .from('crm_notas')
    .delete()
    .eq('contato_id', TEST_CONTACT_ID)
    .like('conteudo', '%DOSSIÊ DE QUALIFICAÇÃO STELLA%');

  const { error: delNotasTransbordoError } = await supabase
    .from('crm_notas')
    .delete()
    .eq('contato_id', TEST_CONTACT_ID)
    .like('conteudo', '%Transbordo Stella IA%');

  console.log('Ficha reativada com sucesso! Pronto para Ranniere mandar a próxima resposta no WhatsApp.');
}

reactivateLead().catch(console.error);
