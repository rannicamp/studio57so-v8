const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function test() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("=== TODOS OS USUARIOS ===");
    const { data: dbUsers, error } = await supabase
        .from('usuarios')
        .select('id, email, nome, funcao_id, is_superadmin, organizacao_id')
        .limit(20);
        
    if (error) {
        console.error("Erro ao buscar usuários:", error);
    } else {
        console.log(dbUsers);
    }

    console.log("=== TODAS AS FUNCOES ===");
    const { data: funcoes, error: errFuncoes } = await supabase
        .from('funcoes')
        .select('*');
        
    if (errFuncoes) {
        console.error("Erro ao buscar funções:", errFuncoes);
    } else {
        console.log(funcoes);
    }
}

test();
