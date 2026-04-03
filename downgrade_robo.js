const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function downgradeUser() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data, error } = await supabase.from('usuarios').update({
        is_superadmin: false,
        funcao_id: 1,      // 1 = Proprietário
        organizacao_id: 1  // Organização 1
    }).eq('email', 'rannierecampos1@gmail.com').select('id, email, is_superadmin, funcao_id, organizacao_id');
    
    if (error) {
        console.error("Erro ao fazer downgrade:", error);
    } else {
        console.log("Usuário rebaixado com sucesso para Proprietário Normal:", data);
    }
}

downgradeUser();
