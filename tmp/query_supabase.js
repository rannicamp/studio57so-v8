require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: testProd, error: prodErr } = await supabase
        .from('produtos_empreendimento')
        .select('*')
        .limit(1);
        
    if (prodErr) {
        console.error("Erro produtos_empreendimento:", prodErr);
    } else {
        console.log("Produtos:", testProd);
    }
}

check();
