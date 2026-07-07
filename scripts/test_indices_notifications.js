const { Client } = require('pg');

async function run() {
  const connectionString = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres';
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Conectado ao Supabase');

    // 1. Encontra o ID do template de índices governamentais
    const resTemplate = await client.query(`
      SELECT id FROM public.sys_notification_templates 
      WHERE tabela_alvo = 'indices_governamentais' AND evento = 'INSERT' LIMIT 1;
    `);
    
    if (resTemplate.rows.length === 0) {
      throw new Error('Template de indices_governamentais não encontrado.');
    }
    const templateId = resTemplate.rows[0].id;
    console.log(`📌 ID do Template de Índices: ${templateId}`);

    // Limpeza inicial de possíveis resíduos
    await client.query(`DELETE FROM public.indices_governamentais WHERE nome_indice = 'TEST_INCC_DEVONILDO';`);
    await client.query(`DELETE FROM public.notificacoes WHERE titulo LIKE '📊 Índice Atualizado: TEST_INCC_DEVONILDO%';`);
    await client.query(`DELETE FROM public.sys_user_notification_prefs WHERE template_id = $1 AND usuario_id IN (
      SELECT id FROM public.usuarios WHERE email IN ('rannierecampos@studio57.arq.br')
    );`, [templateId]);

    // 2. Buscar usuários de teste ativos de organizações diferentes
    // Vamos pegar o Ranniere Campos (geralmente Org 2) e algum usuário da Org 1
    const resUsers = await client.query(`
      SELECT id, nome, email, organizacao_id 
      FROM public.usuarios 
      WHERE is_active = true 
      ORDER BY organizacao_id ASC;
    `);

    if (resUsers.rows.length === 0) {
      throw new Error('Nenhum usuário ativo encontrado para testar.');
    }

    console.log(`👥 Usuários ativos encontrados para teste: ${resUsers.rows.length}`);
    const ranniere = resUsers.rows.find(u => u.email === 'rannierecampos@studio57.arq.br');
    const outroUser = resUsers.rows.find(u => u.id !== ranniere?.id);

    console.log(`👤 Usuário A: ${ranniere ? ranniere.nome : 'N/A'} (Org: ${ranniere ? ranniere.organizacao_id : 'N/A'}, Email: ${ranniere ? ranniere.email : 'N/A'})`);
    console.log(`👤 Usuário B: ${outroUser ? outroUser.nome : 'N/A'} (Org: ${outroUser ? outroUser.organizacao_id : 'N/A'}, Email: ${outroUser ? outroUser.email : 'N/A'})`);

    // --- TESTE 1: INSERÇÃO SEM BLOQUEIO ---
    console.log('\n--- 🚀 TESTE 1: Inserindo Índice Governamental com notificações ativas por padrão ---');
    
    // Inserindo na tabela indices_governamentais com organizacao_id = 1 (Matriz/Sistema)
    await client.query(`
      INSERT INTO public.indices_governamentais (nome_indice, mes_ano, data_referencia, valor_mensal, organizacao_id, descricao)
      VALUES ('TEST_INCC_DEVONILDO', '07/2026', '2026-07-01', 0.45, 1, 'Teste Devonildo');
    `);
    console.log('📝 Índice inserido com sucesso.');

    // Aguarda um instante para as triggers rodarem
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verifica as notificações criadas
    const resNotifs1 = await client.query(`
      SELECT n.id, n.user_id, n.organizacao_id, n.titulo, n.mensagem 
      FROM public.notificacoes n
      WHERE n.titulo = '📊 Índice Atualizado: TEST_INCC_DEVONILDO';
    `);

    console.log(`🔔 Notificações geradas no banco: ${resNotifs1.rows.length}`);
    resNotifs1.rows.forEach(n => {
      const u = resUsers.rows.find(usr => usr.id === n.user_id);
      console.log(`   👉 Destinatário: ${u ? u.nome : n.user_id} | Org Notificação: ${n.organizacao_id} | Mensagem: ${n.mensagem}`);
    });

    if (resNotifs1.rows.length === 0) {
      throw new Error('Nenhuma notificação foi gerada no Teste 1!');
    }

    // --- TESTE 2: DESATIVANDO NOTIFICAÇÃO NO PERFIL ---
    if (ranniere) {
      console.log(`\n--- 🚀 TESTE 2: Desativando notificação do Ranniere no perfil ---`);

      // Simula o switch "Web" sendo desligado (canal_sistema = false)
      await client.query(`
        INSERT INTO public.sys_user_notification_prefs (usuario_id, template_id, canal_sistema, canal_push, organizacao_id)
        VALUES ($1, $2, false, true, $3);
      `, [ranniere.id, templateId, ranniere.organizacao_id]);
      console.log(`🚫 Preferência salva: Ranniere Campos desativou notificações do template ${templateId}.`);

      // Insere outro índice na tabela
      await client.query(`
        INSERT INTO public.indices_governamentais (nome_indice, mes_ano, data_referencia, valor_mensal, organizacao_id, descricao)
        VALUES ('TEST_INCC_DEVONILDO', '08/2026', '2026-08-01', 0.52, 1, 'Teste Devonildo 2');
      `);
      console.log('📝 Segundo índice inserido.');

      // Aguarda triggers
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verifica notificações geradas para o segundo índice
      const resNotifs2 = await client.query(`
        SELECT n.id, n.user_id, n.organizacao_id, n.titulo, n.mensagem 
        FROM public.notificacoes n
        WHERE n.titulo = '📊 Índice Atualizado: TEST_INCC_DEVONILDO' AND n.mensagem LIKE '%08/2026%';
      `);

      console.log(`🔔 Notificações geradas para o segundo índice: ${resNotifs2.rows.length}`);
      
      const ranniereRecebeu = resNotifs2.rows.some(n => n.user_id === ranniere.id);
      if (ranniereRecebeu) {
        throw new Error('❌ ERRO: Ranniere recebeu a notificação mesmo com ela desativada no perfil!');
      } else {
        console.log('✅ SUCESSO: Ranniere NÃO recebeu a notificação (preferência respeitada).');
      }

      resNotifs2.rows.forEach(n => {
        const u = resUsers.rows.find(usr => usr.id === n.user_id);
        console.log(`   👉 Destinatário: ${u ? u.nome : n.user_id} | Org Notificação: ${n.organizacao_id} | Mensagem: ${n.mensagem}`);
      });
    }

    // --- LIMPEZA DE DADOS DE TESTE ---
    console.log('\n🧹 Limpando dados de teste...');
    await client.query(`DELETE FROM public.indices_governamentais WHERE nome_indice = 'TEST_INCC_DEVONILDO';`);
    await client.query(`DELETE FROM public.notificacoes WHERE titulo LIKE '📊 Índice Atualizado: TEST_INCC_DEVONILDO%';`);
    if (ranniere) {
      await client.query(`DELETE FROM public.sys_user_notification_prefs WHERE template_id = $1 AND usuario_id = $2;`, [templateId, ranniere.id]);
    }
    console.log('✨ Banco de dados limpo!');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada.');
  }
}

run();
