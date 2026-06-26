// Caminho: scripts/criar-usuario-demo.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos nas variáveis de ambiente");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const DEMO_EMAIL = 'elo57@studio57.arq.br';
const DEMO_PASSWORD = 'Elo57demo';
const ORG_ID = 57;

async function setupDemoUser() {
  console.log(`🔄 Iniciando setup do usuário de demonstração: ${DEMO_EMAIL}...`);

  try {
    // 1. Limpar usuário anterior se existir na tabela public.usuarios
    console.log("🧹 Procurando registros antigos...");
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('id, funcao_id')
      .eq('email', DEMO_EMAIL)
      .single();

    if (existingUser) {
      console.log(`🧹 Deletando usuário antigo da tabela public.usuarios e Auth (ID: ${existingUser.id})...`);
      // Deletar da tabela public.usuarios
      await supabase.from('usuarios').delete().eq('id', existingUser.id);
      // Limpar permissões antigas daquele cargo
      if (existingUser.funcao_id) {
        await supabase.from('permissoes').delete().eq('funcao_id', existingUser.funcao_id);
      }
      // Deletar da tabela auth.users
      const { error: authDelErr } = await supabase.auth.admin.deleteUser(existingUser.id);
      if (authDelErr) console.warn("Aviso ao deletar usuário do Auth:", authDelErr.message);
    }

    // 2. Criar função Proprietário para a Org 57 (deixando o ID ser gerado automaticamente)
    console.log("👔 Criando função Proprietário para a Org 57 na tabela funcoes...");
    // Limpamos funções anteriores com nome_funcao 'Proprietário' na Org 57
    await supabase.from('funcoes').delete().eq('organizacao_id', ORG_ID).eq('nome_funcao', 'Proprietário');
    
    const { data: cargoData, error: cargoErr } = await supabase.from('funcoes').insert({
      nome_funcao: 'Proprietário',
      descricao: 'Diretoria e Administração Geral da Holding',
      organizacao_id: ORG_ID
    }).select('id').single();
    
    if (cargoErr) throw cargoErr;
    const cargoId = cargoData.id;
    console.log(`✅ Função Proprietário criada com ID: ${cargoId}`);

    // 2.1 Criar Permissões Completas para o Cargo Proprietário na Org 57
    console.log("🔑 Inserindo/Atualizando permissões de acesso aos recursos para o cargo...");
    const recursos = [
      'painel', 'financeiro', 'recursos_humanos', 'empresas', 'empreendimentos',
      'contratos', 'relatorios', 'caixa_de_entrada', 'crm', 'tabela_vendas',
      'contatos', 'simulador', 'orcamento', 'pedidos', 'almoxarifado', 'rdo',
      'atividades', 'bim'
    ];

    const permissoesParaInserir = recursos.map(rec => ({
      funcao_id: cargoId,
      recurso: rec,
      pode_ver: true,
      pode_criar: true,
      pode_editar: true,
      pode_excluir: true,
      organizacao_id: ORG_ID
    }));

    // Usamos UPSERT para evitar violações de chaves duplicadas causadas por triggers de banco
    const { error: permErr } = await supabase.from('permissoes').upsert(permissoesParaInserir, {
      onConflict: 'funcao_id,recurso'
    });
    if (permErr) throw permErr;
    console.log("✅ Permissões de Proprietário concedidas com sucesso!");

    // 3. Criar usuário no Supabase Auth (tabela auth.users)
    console.log("🔑 Criando usuário no Supabase Auth...");
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true
    });

    if (authErr) {
      throw new Error(`Falha ao criar usuário no Auth: ${authErr.message}`);
    }

    const newUserId = authData.user.id;
    console.log(`✅ Usuário do Auth criado com sucesso! UUID: ${newUserId}`);

    // 4. Inserir usuário na tabela public.usuarios
    console.log("📇 Inserindo usuário na tabela public.usuarios...");
    const { error: userErr } = await supabase.from('usuarios').insert({
      id: newUserId,
      email: DEMO_EMAIL,
      nome: 'Demonstração',
      sobrenome: 'Elo 57',
      is_active: true,
      funcao_id: cargoId, // Vincula ao ID do cargo gerado dinamicamente
      organizacao_id: ORG_ID,
      sidebar_position: 'left',
      preferencias_notificacao: { sistema: true, comercial: true, financeiro: true, operacional: true }
    });

    if (userErr) {
      throw new Error(`Erro ao inserir na tabela usuarios: ${userErr.message}`);
    }

    console.log("🚀 ======================================================= 🚀");
    console.log("🎉 PARABÉNS! USUÁRIO DE DEMONSTRAÇÃO E PERMISSÕES CONFIGURADAS!");
    console.log(`📧 E-mail: ${DEMO_EMAIL}`);
    console.log(`🔑 Senha: ${DEMO_PASSWORD}`);
    console.log(`🏢 Organização vinculada: Vanguard Incorporações (ID: ${ORG_ID})`);
    console.log("💡 Dica: Agora você pode logar com este e-mail no servidor local!");
    console.log("🚀 ======================================================= 🚀");

  } catch (error) {
    console.error("❌ OCORREU UM ERRO AO CONFIGURAR O USUÁRIO:", error.message);
  }
}

setupDemoUser();
