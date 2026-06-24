const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_CONTACT_ID = 5923; // ID do contato de teste (Ranniere Campos)
const ORGANIZACAO_ID = 2;
const STELLA_CONTACT_ID = 5792; // ID do contato da Stella na Org 2
const COLUNA_ENTRADA_ID = 'e8e88027-c7be-4e8c-9667-e17fa4e06ce5'; // ID da coluna de entrada no funil

async function resetLead() {
  console.log(`=== RESETANDO LEAD DE TESTES (ID ${TEST_CONTACT_ID}) E LIMPINDO HISTÓRICO ===`);

  // 1. Remover last_message_id da conversa para evitar erros de FK
  console.log('1. Desvinculando last_message_id na tabela whatsapp_conversations...');
  const { error: resetConvError } = await supabase
    .from('whatsapp_conversations')
    .update({ last_message_id: null })
    .eq('contato_id', TEST_CONTACT_ID);

  if (resetConvError) {
    console.error('Erro ao atualizar whatsapp_conversations:', resetConvError.message);
  } else {
    console.log('Conversa desvinculada!');
  }

  // 2. Limpar mensagens do WhatsApp vinculadas ao lead
  console.log('2. Deletando mensagens do WhatsApp...');
  const { error: delMsgsError } = await supabase
    .from('whatsapp_messages')
    .delete()
    .eq('contato_id', TEST_CONTACT_ID);

  if (delMsgsError) {
    console.error('Erro ao deletar mensagens:', delMsgsError.message);
  } else {
    console.log('Mensagens deletadas com sucesso!');
  }

  // 3. Limpar notas do CRM
  console.log('3. Deletando notas do CRM...');
  const { error: delNotasError } = await supabase
    .from('crm_notas')
    .delete()
    .eq('contato_id', TEST_CONTACT_ID);

  if (delNotasError) {
    console.error('Erro ao deletar notas:', delNotasError.message);
  } else {
    console.log('Notas do CRM deletadas com sucesso!');
  }

  // 4. Resetar o cadastro do contato
  console.log('4. Resetando dados cadastrais e ativando piloto automático...');
  const { error: resetContactError } = await supabase
    .from('contatos')
    .update({
      nome: 'Ranniere Campos',
      ia_atendimento_ativo: true,
      ai_analysis: null,
      origem: null,
      objetivo: null,
      cargo: null,
      estado_civil: null,
      renda_familiar: null,
      fgts: null,
      mais_de_3_anos_clt: null,
      observations: 'Lead de teste resetado para nova validação da Stella SDR 2.0.'
    })
    .eq('id', TEST_CONTACT_ID);

  if (resetContactError) {
    console.error('Erro ao resetar cadastro do contato:', resetContactError.message);
  } else {
    console.log('Cadastro do contato resetado!');
  }

  // 5. Mover o lead para a coluna de Entrada da Stella no funil
  console.log('5. Posicionando lead na coluna de Entrada do Funil...');
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
        coluna_id: COLUNA_ENTRADA_ID,
        corretor_id: STELLA_CONTACT_ID
      })
      .eq('id', funil.id);

    if (updateFunilError) {
      console.error('Erro ao atualizar funil:', updateFunilError.message);
    } else {
      console.log('Lead movido para Entrada e atribuído à Stella!');
    }
  } else {
    const { error: insertFunilError } = await supabase
      .from('contatos_no_funil')
      .insert({
        contato_id: TEST_CONTACT_ID,
        coluna_id: COLUNA_ENTRADA_ID,
        corretor_id: STELLA_CONTACT_ID,
        organizacao_id: ORGANIZACAO_ID
      });

    if (insertFunilError) {
      console.error('Erro ao inserir lead no funil:', insertFunilError.message);
    } else {
      console.log('Lead criado na Entrada e atribuído à Stella!');
    }
  }

  console.log('\n=== RESET CONCLUÍDO COM SUCESSO! LEAD PRONTO PARA RECEBER MENSAGENS REALÍSTICAS ===');
}

resetLead().catch(console.error);
