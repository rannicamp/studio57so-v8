const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function test() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("=== DIAGNOSTICO DE PERMISSOES DA FUNÇÃO 28 (Comercial - Org 2) ===");
    
    // 1. Buscar permissões da função 28
    const { data: perms28, error: errPerms } = await supabase
        .from('permissoes')
        .select('*')
        .eq('funcao_id', 28);
        
    if (errPerms) {
        console.error("Erro ao buscar permissões da função 28:", errPerms);
    } else {
        console.log("Permissões da função 28:", perms28);
    }

    // 2. Buscar permissões da função 7 (Comercial - Org 1) para comparação
    const { data: perms7, error: errPerms7 } = await supabase
        .from('permissoes')
        .select('*')
        .eq('funcao_id', 7);
        
    if (errPerms7) {
        console.error("Erro ao buscar permissões da função 7:", errPerms7);
    } else {
        console.log("Permissões da função 7 (Comercial Org 1):", perms7);
    }

    // 3. Buscar se o Wilson tem contato como Corretor e se isso afeta
    // Vamos checar se o email wilsondutrafilho@hotmail.com é usado no contato de id 3810
    const { data: emails, error: errEmails } = await supabase
        .from('emails')
        .select('*')
        .eq('contato_id', 3810);
        
    if (errEmails) {
        console.error("Erro ao buscar e-mails do contato 3810:", errEmails);
    } else {
        console.log("E-mails do contato 3810:", emails);
    }
}

test();
