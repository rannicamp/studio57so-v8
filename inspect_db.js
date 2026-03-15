const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSchema() {
    console.log("Fetching schema sample...");
    const { data: elBim, error: err1 } = await supabase.from('elementos_bim').select('*').limit(1);
    console.log("elementos_bim sample:", err1 || elBim[0]);

    const { data: atvEl, error: err2 } = await supabase.from('atividades_elementos').select('*').limit(1);
    console.log("atividades_elementos sample:", err2 || atvEl[0]);

    const { data: atv, error: err3 } = await supabase.from('activities').select('*').limit(1);
    console.log("activities sample:", err3 || atv[0]);
}

checkSchema().catch(console.error);
