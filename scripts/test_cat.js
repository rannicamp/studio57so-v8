const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    let res = await supabase.from('categorias_financeiras').select('id, nome').ilike('nome', '%Estorno%');
    console.log("Estornos:", res.data);
    res = await supabase.from('categorias_financeiras').select('id, nome').ilike('nome', '%Transfer%ncia%');
    console.log("Transferencias:", res.data);
}
check();
