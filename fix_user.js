const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function fixUser() {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // 1. Pegar o ID do robô na auth
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const robo = authData.users.find(u => u.email === 'rannierecampos1@gmail.com');
    
    if (!robo) {
        console.log("Robô não encontrado no auth.");
        return;
    }
    
    // 2. Inserir manualmente na tabela usuarios
    const { data, error } = await supabaseAdmin.from('usuarios').insert({
        id: robo.id,
        nome: "Robô Testador",
        email: "rannierecampos1@gmail.com",
        funcao_id: 1, // Pode ser uma genérica
        organizacao_id: 1, // Organização Elo 57
        is_superadmin: true
    }).select();

    if (error) {
        console.error("Erro ao inserir na tabela usuarios:", error);
    } else {
        console.log("✅ Robô inserido com sucesso na tabela usuarios:", data);
    }
}

fixUser();
