const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: contas, error } = await supabase
        .from('contas_financeiras')
        .select('id, nome, tipo');
        
    console.log("CONTAS:");
    contas.forEach(c => console.log(`${c.id}: ${c.nome} (${c.tipo})`));
}
run();
