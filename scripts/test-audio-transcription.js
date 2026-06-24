const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_CONTACT_ID = 5923; // ID do contato de teste (Ranniere Campos)
const ORGANIZACAO_ID = 2;
const MESSAGE_ID = 24660; // ID da mensagem de áudio transcrita

async function run() {
  console.log('=== TESTANDO RESPOSTA DA TRANSCRIÇÃO DE ÁUDIO LOCALMENTE ===');
  
  // 1. Garantir que o autopilot esteja ativo para o teste
  console.log(`\n1. Ativando Autopilot para contato ID ${TEST_CONTACT_ID}...`);
  await supabase
    .from('contatos')
    .update({ ia_atendimento_ativo: true })
    .eq('id', TEST_CONTACT_ID);
  
  // 2. Disparar processamento local nas portas 3000 ou 3001
  const ports = ['3000', '3001'];
  let successTrigger = false;

  for (const port of ports) {
    const triggerUrl = `http://localhost:${port}/api/ai/stella/process`;
    console.log(`\n2. Disparando trigger na porta ${port}: ${triggerUrl}...`);
    
    try {
      const res = await fetch(triggerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record: {
            id: MESSAGE_ID,
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
        break;
      } else {
        console.warn(`Aviso no trigger na porta ${port} (Status ${res.status}):`, await res.text());
      }
    } catch (err) {
      console.warn(`Falha na conexão com a porta ${port}: ${err.message}`);
    }
  }

  if (!successTrigger) {
    console.error('\n[ERRO] Não foi possível disparar o trigger local.');
    return;
  }

  // 3. Aguardar processamento das pílulas
  console.log('\n3. Aguardando 15 segundos para a Stella processar e responder...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  // 4. Buscar respostas outbound
  console.log('\n4. Buscando respostas da Stella no banco de dados...');
  const { data: respostasOutbound, error: fetchErr } = await supabase
    .from('whatsapp_messages')
    .select('id, content, status, created_at, error_message')
    .eq('contato_id', TEST_CONTACT_ID)
    .eq('direction', 'outbound')
    .order('created_at', { ascending: true });

  if (fetchErr) {
    console.error('Erro ao buscar respostas:', fetchErr.message);
  } else if (respostasOutbound && respostasOutbound.length > 0) {
    console.log(`\n=========================================`);
    console.log(`🤖 RESPOSTAS DA STELLA PARA O ÁUDIO (${respostasOutbound.length} pílulas):`);
    respostasOutbound.forEach((m, idx) => {
      console.log(`\n--- Pílula ${idx + 1} ---`);
      console.log(`[Status: ${m.status}${m.error_message ? ` - Erro: ${m.error_message}` : ''}]`);
      console.log(`Conteúdo:\n"${m.content}"`);
    });
    console.log(`=========================================`);
  } else {
    console.log('A Stella não gerou nenhuma resposta outbound localmente.');
  }
}

run().catch(console.error);
