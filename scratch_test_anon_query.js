require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
let supabaseUrl = '';
let supabaseAnonKey = '';
envFile.split(/\r?\n/).forEach(l => {
  if (l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = l.substring('NEXT_PUBLIC_SUPABASE_URL='.length).trim().replace(/['"]/g, '');
  }
  if (l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    supabaseAnonKey = l.substring('NEXT_PUBLIC_SUPABASE_ANON_KEY='.length).trim().replace(/['"]/g, '');
  }
});

// Inicializa o cliente Supabase sem autenticação (como o browser rodaria antes de logar, ou com token se logado)
// Mas peraí, o RLS exige usuário logado. Vamos criar o cliente.
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    // 1. Tentar ler sem login
    console.log("=== LENDO ELEMENTOS_BIM SEM LOGIN ===");
    const { data: dataNoAuth, error: errorNoAuth } = await supabase
      .from('elementos_bim')
      .select('id, external_id, categoria, familia, tipo')
      .eq('projeto_bim_id', 41)
      .eq('categoria', 'Revit Paredes')
      .eq('familia', 'Parede básica')
      .limit(10);
    
    if (errorNoAuth) {
      console.error("Erro sem auth:", errorNoAuth.message);
    } else {
      console.log(`Sucesso sem auth! Retornou ${dataNoAuth.length} elementos.`);
    }

    // 2. Fazer login com o usuário do Ranniere
    console.log("\n=== LOGANDO COM USUÁRIO DO RANNIERE ===");
    // O e-mail do Ranniere costuma ser rannierecampos@gmail.com ou similar, vamos buscar no banco de auth.users?
    // Não temos acesso direto ao auth.users facilmente por SQL simples a menos que busquemos na tabela de profiles/users
    // Vamos ver na tabela public.profiles ou public.colaboradores ou public.users para pegar o email do Ranniere
    // Ou podemos fazer login com a service role key do supabase para ignorar RLS e testar?
    // Não, queremos simular o RLS.
    // Mas espere, se o Ranniere está rodando localmente, ele está logado.
    // Vamos fazer uma query na tabela public.profiles para ver as contas cadastradas.
  } catch(err) {
      console.error(err);
  }
}
run();
