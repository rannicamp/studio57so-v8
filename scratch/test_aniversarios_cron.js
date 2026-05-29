const { createClient } = require('@supabase/supabase-js');

async function testCron() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Erro: Variáveis do Supabase não encontradas no process.env!");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Configurar datas de teste
  const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('pt-BR', options);
  const [{ value: day }, , { value: month }, , { value: year }] = formatter.formatToParts(new Date());
  
  // Data de aniversário correspondente a hoje, mas com o ano de 1990
  const birthDateTest = `1990-${month}-${day}`;
  
  console.log(`[TESTE] Configurando aniversariante de teste com birth_date: ${birthDateTest}`);

  let testFuncId = null;
  let testClientId = null;
  const orgId = 2; // Organização de teste (Studio 57)

  try {
    // 2. Inserir funcionário de teste
    console.log("[TESTE] Criando funcionário de teste...");
    const { data: func, error: fErr } = await supabase.from('funcionarios').insert({
      full_name: 'Funcionário Aniversariante Teste',
      birth_date: birthDateTest,
      status: 'Ativo',
      empresa_id: 4,
      cpf: '999.999.999-99',
      admission_date: '2025-03-11',
      organizacao_id: orgId
    }).select().single();

    if (fErr) throw fErr;
    testFuncId = func.id;
    console.log(`[TESTE] Funcionário criado com ID: ${testFuncId}`);

    // 3. Inserir cliente de teste
    console.log("[TESTE] Criando cliente (contato) de teste...");
    const { data: client, error: cErr } = await supabase.from('contatos').insert({
      nome: 'Cliente Aniversariante Teste',
      birth_date: birthDateTest,
      status: 'Ativo',
      tipo_contato: 'Cliente',
      organizacao_id: orgId
    }).select().single();

    if (cErr) throw cErr;
    testClientId = client.id;
    console.log(`[TESTE] Cliente criado com ID: ${testClientId}`);

    // 4. Chamar o endpoint local /api/cron/aniversarios
    console.log("[TESTE] Batendo na rota da API local...");
    const response = await fetch('http://localhost:3000/api/cron/aniversarios');
    const status = response.status;
    const result = await response.json();

    console.log(`[TESTE] Status Retornado: ${status}`);
    console.log("[TESTE] Resultado da API:\n", JSON.stringify(result, null, 2));

    // 5. Verificar se os posts correspondentes foram criados no mural
    console.log("[TESTE] Consultando mural para verificar novos posts...");
    const { data: posts, error: pErr } = await supabase
      .from('sys_chat_mural_posts')
      .select('*')
      .eq('organizacao_id', orgId)
      .like('assunto', '🎉 Feliz Aniversário%')
      .gte('created_at', new Date().toISOString().split('T')[0]);

    if (pErr) throw pErr;
    console.log(`[TESTE] Posts de aniversário encontrados no mural de hoje: ${posts.length}`);
    posts.forEach(p => {
      console.log(`- Assunto: "${p.assunto}"\n- Conteúdo: "${p.conteudo.slice(0, 100)}..."\n`);
    });

    if (posts.length >= 2) {
      console.log("👉 SUCESSO! A rota de cron identificou os aniversariantes e publicou corretamente no mural!");
    } else {
      console.error("❌ FALHA! Os posts não foram encontrados no mural.");
    }

    // 6. Limpar os dados de teste criados (para manter o banco higienizado)
    console.log("[TESTE] Iniciando limpeza das informações de teste...");
    if (testFuncId) {
      await supabase.from('funcionarios').delete().eq('id', testFuncId);
      console.log("- Funcionário de teste removido.");
    }
    if (testClientId) {
      await supabase.from('contatos').delete().eq('id', testClientId);
      console.log("- Cliente de teste removido.");
    }
    
    // Remover os posts de teste do mural
    for (const post of posts) {
      if (post.assunto.includes('Aniversariante Teste')) {
        await supabase.from('sys_chat_mural_posts').delete().eq('id', post.id);
        console.log(`- Post "${post.assunto}" de teste removido.`);
      }
    }

    console.log("[TESTE] Banco de dados limpo com sucesso!");

  } catch (error) {
    console.error("❌ ERRO NO PROCESSO DE TESTE:", error);
    // Tenta limpar em caso de erro
    if (testFuncId) await supabase.from('funcionarios').delete().eq('id', testFuncId);
    if (testClientId) await supabase.from('contatos').delete().eq('id', testClientId);
  }
}

testCron();
