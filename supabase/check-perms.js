require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkComercialPerm() {
    console.log("🔍 Buscando funções e permissões...");

    // 1. Achar a função "Comercial"
    const { data: func, error: err1 } = await supabase
        .from('funcoes')
        .select('*')
        .ilike('nome_funcao', '%Comercial%')
        .limit(1)
        .single();

    if (err1) {
        console.error("Cargo Comercial nao encontrado:", err1.message);
        return;
    }

    console.log(`✅ Cargo encontrado: ${func.nome_funcao} (ID: ${func.id})`);

    // 2. Achar permissões para esse cargo
    const { data: perms } = await supabase
        .from('permissoes')
        .select('*')
        .eq('funcao_id', func.id)
        .eq('recurso', 'caixa_de_entrada');

    if (!perms || perms.length === 0) {
        console.log(`❌ Nenhuma permissão cadastrada para 'caixa_de_entrada' neste cargo!`);
    } else {
        console.log("📊 Permissão caixa_de_entrada:");
        console.log(perms[0]);
    }
}

checkComercialPerm();
