const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cats } = await supabase.from('categorias_financeiras').select('id, nome').ilike('nome', '%Empr%sti%');
    console.log("Categorias encontradas:", cats);
    
    const catIds = cats?.map(c => c.id) || [];
    
    if (catIds.length === 0) {
        console.log("Nenhuma categoria de empréstimo.");
        return;
    }
    
    const { data: lancamentos, error } = await supabase
        .from('lancamentos')
        .select(`
            id,
            descricao,
            valor,
            tipo,
            status,
            data_vencimento,
            data_pagamento,
            categorias_financeiras(nome)
        `)
        .in('categoria_id', catIds)
        .order('data_vencimento', { ascending: false });
        
    if (error) console.error(error);
    const fs = require('fs');
    fs.writeFileSync('scripts/tmp_emprestimos.json', JSON.stringify(lancamentos, null, 2));
    console.log("Found:", lancamentos?.length);
}
run();
