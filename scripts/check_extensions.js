require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkfiles() {
    const { data } = await supabase
        .from('empresa_anexos')
        .select('id, nome_arquivo, caminho_arquivo')
        .eq('empresa_id', 4);
        
    console.log(JSON.stringify(data, null, 2));
}

checkfiles();
