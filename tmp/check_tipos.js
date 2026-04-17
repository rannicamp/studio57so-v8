require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkTypes() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: unidades, error } = await supabase.from('produtos_empreendimento').select('id, unidade, tipo, area_m2, empreendimento_id');
    
    if (error) {
        console.error("Erro:", error);
        return;
    }

    const types = {};
    unidades.forEach(u => {
        const t = u.tipo || 'NULL';
        if (!types[t]) types[t] = 0;
        types[t]++;
    });

    console.log("=== RESUMO DE TIPOS ATUAIS ===");
    console.table(types);
    
    // Mostrando amostra de itens para entender as falhas
    console.log("\n=== AMOSTRA DE UNIDADES ===");
    console.table(unidades.slice(0, 15).map(u => ({ id: u.id, unidade: u.unidade, tipo: u.tipo })));
}
checkTypes();
