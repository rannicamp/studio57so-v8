const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  const contato_id = 5598;
  const organizacao_id = 2;
  const telefone_cliente = '5533991912291';

  console.log('=== TESTE DE DUPLICIDADE DE ANEXOS DA STELLA ===\n');

  try {
    // 1. Limpar histórico anterior do contato de teste
    console.log('Limpando mensagens antigas do contato 5598...');
    await client.query('UPDATE public.whatsapp_conversations SET last_message_id = NULL WHERE contato_id = $1;', [contato_id]);
    await client.query('DELETE FROM public.whatsapp_messages WHERE contato_id = $1;', [contato_id]);

    // 2. Buscar dados do anexo do Residencial Alfa (ID 1) no banco
    const anexoRes = await client.query(`
      SELECT id, nome_arquivo, caminho_arquivo 
      FROM public.empreendimento_anexos 
      WHERE empreendimento_id = 1 AND disponivel_corretor = true AND organizacao_id = $1
      LIMIT 1;
    `, [organizacao_id]);

    if (anexoRes.rows.length === 0) {
      console.error('Nenhum anexo encontrado para o Residencial Alfa (ID 1).');
      await client.end();
      return;
    }

    const bookAlfa = anexoRes.rows[0];
    console.log(`Anexo de teste (Book do Residencial Alfa): "${bookAlfa.nome_arquivo}" | Caminho: "${bookAlfa.caminho_arquivo}"\n`);

    // --- RODADA 1: Pedindo informações pela primeira vez (esperamos o anexo sugerido) ---
    console.log('--- RODADA 1: Cliente pergunta pela primeira vez sobre o Alfa ---');
    const msgId1 = 'wamid.TEST_DUP_1_' + Date.now();
    await client.query(`
      INSERT INTO public.whatsapp_messages (message_id, contato_id, direction, content, status, sent_at, organizacao_id, sender_id, receiver_id)
      VALUES ($1, $2, 'inbound', 'Olá, tudo bem? Gostaria de saber mais informações sobre o Residencial Alfa.', 'read', NOW(), $3, $4, 'system');
    `, [msgId1, contato_id, organizacao_id, telefone_cliente]);

    await client.query(`
      UPDATE public.whatsapp_conversations SET last_message_id = (SELECT id FROM public.whatsapp_messages WHERE message_id = $1) WHERE contato_id = $2;
    `, [msgId1, contato_id]);

    let res1 = await fetch('http://localhost:3000/api/ai/chat-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contato_id, organizacao_id, force: true, quickResponse: true })
    });

    if (res1.ok) {
      const data = await res1.json();
      console.log('Stella respondeu:');
      console.log(`> "${data.proxima_resposta_sugerida}"`);
      console.log('Anexo sugerido:', data.anexo_sugerido ? `"${data.anexo_sugerido.nome_arquivo}"` : 'null');
      console.log(`Esperado: Book do Residencial Alfa ou similar (Não nulo).\n`);
    } else {
      console.error('Erro na Rodada 1:', await res1.text());
    }

    // --- RODADA 2: Simulando que o anexo foi enviado e o cliente continua a conversa ---
    console.log('--- RODADA 2: Marcando o anexo como enviado e continuando a conversa ---');
    // Insere a mensagem de anexo na tabela public.whatsapp_messages (com direction = 'outbound' e media_url)
    const msgAnexoId = 'wamid.TEST_DUP_ANEXO_' + Date.now();
    await client.query(`
      INSERT INTO public.whatsapp_messages (message_id, contato_id, direction, content, status, sent_at, organizacao_id, sender_id, media_url, receiver_id)
      VALUES ($1, $2, 'outbound', $3, 'sent', NOW() + INTERVAL '1 second', $4, 'system', $5, $6);
    `, [msgAnexoId, contato_id, bookAlfa.nome_arquivo, organizacao_id, 'https://supabase.co/storage/v1/object/public/empreendimento-anexos/' + bookAlfa.caminho_arquivo, telefone_cliente]);

    // Insere resposta de texto da Stella no histórico
    const msgStella = 'wamid.TEST_DUP_STELLA_' + Date.now();
    await client.query(`
      INSERT INTO public.whatsapp_messages (message_id, contato_id, direction, content, status, sent_at, organizacao_id, sender_id, receiver_id)
      VALUES ($1, $2, 'outbound', 'Claro! Aqui está o book do Residencial Alfa com todos os detalhes.', 'read', NOW() + INTERVAL '2 seconds', $3, 'system', $4);
    `, [msgStella, contato_id, organizacao_id, telefone_cliente]);

    // Cliente pergunta outra coisa (sem pedir o book de novo)
    const msgId2 = 'wamid.TEST_DUP_2_' + Date.now();
    await client.query(`
      INSERT INTO public.whatsapp_messages (message_id, contato_id, direction, content, status, sent_at, organizacao_id, sender_id, receiver_id)
      VALUES ($1, $2, 'inbound', 'Qual a área de lazer dele?', 'read', NOW() + INTERVAL '3 seconds', $3, $4, 'system');
    `, [msgId2, contato_id, organizacao_id, telefone_cliente]);

    await client.query(`
      UPDATE public.whatsapp_conversations SET last_message_id = (SELECT id FROM public.whatsapp_messages WHERE message_id = $1) WHERE contato_id = $2;
    `, [msgId2, contato_id]);

    let res2 = await fetch('http://localhost:3000/api/ai/chat-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contato_id, organizacao_id, force: true, quickResponse: true })
    });

    if (res2.ok) {
      const data = await res2.json();
      console.log('Stella respondeu:');
      console.log(`> "${data.proxima_resposta_sugerida}"`);
      console.log('Anexo sugerido:', data.anexo_sugerido ? `"${data.anexo_sugerido.nome_arquivo}"` : 'null');
      console.log(`Esperado: null (pois o book já foi enviado anteriormente e o cliente não pediu reenvio).\n`);
    } else {
      console.error('Erro na Rodada 2:', await res2.text());
    }

    // --- RODADA 3: Cliente pede o anexo de novo explicitamente ---
    console.log('--- RODADA 3: Cliente solicita reenvio do book explicitamente ---');
    const msgId3 = 'wamid.TEST_DUP_3_' + Date.now();
    await client.query(`
      INSERT INTO public.whatsapp_messages (message_id, contato_id, direction, content, status, sent_at, organizacao_id, sender_id, receiver_id)
      VALUES ($1, $2, 'inbound', 'Pode me mandar o book dele novamente? Eu perdi o arquivo.', 'read', NOW() + INTERVAL '4 seconds', $3, $4, 'system');
    `, [msgId3, contato_id, organizacao_id, telefone_cliente]);

    await client.query(`
      UPDATE public.whatsapp_conversations SET last_message_id = (SELECT id FROM public.whatsapp_messages WHERE message_id = $1) WHERE contato_id = $2;
    `, [msgId3, contato_id]);

    let res3 = await fetch('http://localhost:3000/api/ai/chat-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contato_id, organizacao_id, force: true, quickResponse: true })
    });

    if (res3.ok) {
      const data = await res3.json();
      console.log('Stella respondeu:');
      console.log(`> "${data.proxima_resposta_sugerida}"`);
      console.log('Anexo sugerido:', data.anexo_sugerido ? `"${data.anexo_sugerido.nome_arquivo}"` : 'null');
      console.log(`Esperado: Book do Residencial Alfa (Ignorou a trava de duplicidade porque o cliente pediu reenvio).\n`);
    } else {
      console.error('Erro na Rodada 3:', await res3.text());
    }

    // Limpeza final do contato de teste
    console.log('Limpando mensagens criadas para o teste...');
    await client.query('UPDATE public.whatsapp_conversations SET last_message_id = NULL WHERE contato_id = $1;', [contato_id]);
    await client.query('DELETE FROM public.whatsapp_messages WHERE contato_id = $1;', [contato_id]);

  } catch (err) {
    console.error('Erro durante a execução do teste:', err.message);
  }

  await client.end();
  console.log('Teste de duplicidade finalizado.');
}

main();
