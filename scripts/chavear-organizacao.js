// Caminho: scripts/chavear-organizacao.js
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

const targetOrg = process.argv[2];
const userEmail = 'rannierecampos@studio57.arq.br';

if (!targetOrg) {
  console.log("ℹ️ Uso do script: node --env-file=.env.local scripts/chavear-organizacao.js <ID_DA_ORGANIZACAO>");
  console.log("💡 Exemplo Vanguard: node --env-file=.env.local scripts/chavear-organizacao.js 57");
  console.log("💡 Exemplo Studio 57: node --env-file=.env.local scripts/chavear-organizacao.js 2");
  process.exit(0);
}

async function switchOrg() {
  const orgId = parseInt(targetOrg, 10);
  if (isNaN(orgId)) {
    console.error("❌ ERRO: O ID da organização deve ser um número.");
    process.exit(1);
  }

  console.log(`🔄 Chaveando organização do usuário "${userEmail}" para o ID ${orgId}...`);

  try {
    // Verificar se a organização existe
    const { data: org, error: orgErr } = await supabase.from('organizacoes').select('nome').eq('id', orgId).single();
    if (orgErr || !org) {
      console.error(`❌ ERRO: Organização com ID ${orgId} não encontrada no banco.`);
      process.exit(1);
    }

    // Atualizar no banco
    const { error: updateErr } = await supabase
      .from('usuarios')
      .update({ organizacao_id: orgId })
      .eq('email', userEmail);

    if (updateErr) {
      throw updateErr;
    }

    console.log("🚀 ======================================================= 🚀");
    console.log(`✅ CONCLUÍDO! O usuário agora pertence à: ${org.nome} (Org ID: ${orgId})`);
    console.log("💡 Dica: Se o painel local estiver aberto, basta dar um F5 (recarregar) no navegador.");
    console.log("🚀 ======================================================= 🚀");

  } catch (error) {
    console.error("❌ OCORREU UM ERRO AO ALTERAR A ORGANIZAÇÃO:", error.message);
  }
}

switchOrg();
