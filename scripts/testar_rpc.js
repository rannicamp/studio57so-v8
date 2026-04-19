const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testarRPC() {
    const { data: lancs } = await supabase.from('lancamentos').select('organizacao_id')
        .gte('data_pagamento', '2025-06-01').lte('data_pagamento', '2025-06-30').select('id, valor, organizacao_id, categoria_id');
        
    console.log("Organizacoes dos itens de Junho:");
    let q1 = 0, q2 = 0;
    lancs.forEach(l => {
         if(l.organizacao_id === 1) q1++;
         if(l.organizacao_id === 2) q2++;
    });
    console.log("QTD Org 1:", q1, " QTD Org 2:", q2);
}
testarRPC();
