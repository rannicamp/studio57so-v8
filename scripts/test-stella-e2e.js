const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_CONTACT_ID = 5923; // ID do contato de teste (Ranniere Campos Teste Webhook)
const ORGANIZACAO_ID = 2;
const STELLA_CONTACT_ID = 5792; // ID do contato da Stella na Org 2

async function run() {
  console.log('=== INICIANDO SIMULAÇÃO DE ROBÔ TESTE END-TO-END PARA A STELLA ===');
  
  // 1. Preparar o contato para o teste: Ativar Autopilot e associar Stella como Corretora
  console.log(`\n1. Preparando o contato ID ${TEST_CONTACT_ID} no banco de dados...`);
  
  const { error: updateContactErr } = await supabase
    .from('contatos')
    .update({ 
      ia_atendimento_ativo: true,
      nome: 'Ranniere Campos Teste' 
    })
    .eq('id', TEST_CONTACT_ID);

  if (updateContactErr) {
    console.error('Erro ao atualizar contato:', updateContactErr.message);
    return;
  }

  // Garantir que a Stella seja a corretora responsável no funil comercial
  const { data: funil } = await supabase
    .from('contatos_no_funil')
    .select('id')
    .eq('contato_id', TEST_CONTACT_ID)
    .limit(1)
    .maybeSingle();

  if (funil) {
    const { error: updateFunilErr } = await supabase
      .from('contatos_no_funil')
      .update({ corretor_id: STELLA_CONTACT_ID })
      .eq('id', funil.id);

    if (updateFunilErr) console.error('Erro ao associar Stella no funil:', updateFunilErr.message);
  } else {
    // Se não estiver no funil, insere na coluna de ENTRADA da Stella
    const { error: insertFunilErr } = await supabase
      .from('contatos_no_funil')
      .insert({
        contato_id: TEST_CONTACT_ID,
        coluna_id: 'e8e88027-c7be-4e8c-9667-e17fa4e06ce5', // ENTRADA
        corretor_id: STELLA_CONTACT_ID,
        organizacao_id: ORGANIZACAO_ID
      });
    if (insertFunilErr) console.error('Erro ao inserir lead no funil:', insertFunilErr.message);
  }

  console.log('Contato preparado! Autopilot Ativo = true, Corretora = Stella IA.');

  // 2. Inserir uma nova mensagem inbound do cliente simulando o envio
  const timestampTeste = new Date();
  console.log(`\n2. Simulando mensagem inbound do cliente às ${timestampTeste.toLocaleTimeString('pt-BR')}...`);
  
  const mensagemCliente = "Oi Stella! Vi o anúncio de vocês. Quais empreendimentos vocês têm e quais os valores?";
  
  const { data: insertedMsg, error: insertMsgErr } = await supabase
    .from('whatsapp_messages')
    .insert({
      contato_id: TEST_CONTACT_ID,
      sender_id: '5533991912291', // Remetente (Cliente)
      receiver_id: '690198827516149', // Destinatário (WhatsApp Business)
      direction: 'inbound',
      content: mensagemCliente,
      status: 'received',
      sent_at: timestampTeste.toISOString(),
      created_at: timestampTeste.toISOString(),
      organizacao_id: ORGANIZACAO_ID
    })
    .select('id')
    .single();

  if (insertMsgErr) {
    console.error('Erro ao simular mensagem inbound do cliente:', insertMsgErr.message);
    return;
  }

  console.log(`Mensagem do cliente simulada com sucesso! ID no banco: ${insertedMsg.id}`);

  // 3. Disparar o novo processador de background (tentando porta 3000 e depois 3001)
  const ports = ['3000', '3001'];
  let successTrigger = false;

  for (const port of ports) {
    const triggerUrl = `http://localhost:${port}/api/ai/stella/process`;
    console.log(`\n3. Tentando disparar processamento da Stella na porta ${port}: ${triggerUrl}...`);
    
    try {
      const res = await fetch(triggerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record: {
            id: insertedMsg.id,
            contato_id: TEST_CONTACT_ID,
            organizacao_id: ORGANIZACAO_ID,
            direction: 'inbound',
            from: '5533991912291'
          }
        })
      });

      if (res.ok) {
        const resJson = await res.json();
        console.log(`Sucesso no trigger na porta ${port}:`, resJson);
        successTrigger = true;
        break; // Interrompe se deu certo
      } else {
        console.warn(`Aviso no trigger na porta ${port} (Status ${res.status}):`, await res.text());
      }
    } catch (err) {
      console.warn(`Falha na conexão com a porta ${port}: ${err.message}`);
    }
  }

  if (!successTrigger) {
    console.error('\n[ERRO CRÍTICO] Não foi possível disparar o trigger em nenhuma das portas testadas.');
    // Limpeza antes de sair
    await supabase.from('contatos').update({ ia_atendimento_ativo: false }).eq('id', TEST_CONTACT_ID);
    return;
  }

  // 4. Aguardar as pílulas de resposta da IA serem gravadas no banco
  console.log('\n4. Aguardando 12 segundos para processamento das respostas da Stella...');
  await new Promise(resolve => setTimeout(resolve, 12000));

  // 5. Consultar as mensagens outbound gravadas após o início do teste
  console.log('\n5. Buscando respostas outbound geradas pela Stella no banco de dados...');
  const { data: respostasOutbound, error: fetchErr } = await supabase
    .from('whatsapp_messages')
    .select('id, content, status, created_at, error_message')
    .eq('contato_id', TEST_CONTACT_ID)
    .eq('direction', 'outbound')
    .gt('created_at', timestampTeste.toISOString())
    .order('created_at', { ascending: true });

  if (fetchErr) {
    console.error('Erro ao buscar respostas da Stella:', fetchErr.message);
  } else if (respostasOutbound && respostasOutbound.length > 0) {
    console.log(`\n=========================================`);
    console.log(`🤖 RESPOSTAS ENCONTRADAS DA STELLA (${respostasOutbound.length} pílulas):`);
    respostasOutbound.forEach((m, idx) => {
      console.log(`\n--- Pílula ${idx + 1} ---`);
      console.log(`[Status: ${m.status}${m.error_message ? ` - Erro: ${m.error_message}` : ''}]`);
      console.log(`Conteúdo:\n"${m.content}"`);
    });
    console.log(`=========================================`);
  } else {
    console.log('A Stella não gerou nenhuma resposta outbound.');
  }

  // 6. Limpeza (Retornar autopilot para falso para não interferir)
  console.log('\n6. Finalizando teste e retornando autopilot para inativo...');
  await supabase
    .from('contatos')
    .update({ ia_atendimento_ativo: false })
    .eq('id', TEST_CONTACT_ID);
    
  console.log('Teste concluído com sucesso!');
}

run().catch(console.error);
