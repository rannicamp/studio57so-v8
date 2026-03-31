require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: d, error } = await supabase.from('cadastro_empresa').select('*').eq('id', 4).single();
    if(error){
        console.error(error);
        return;
    }
    const cols = Object.keys(d);
    fs.writeFileSync('ficha.json', JSON.stringify({ colunas: cols, dados: d }, null, 2));
    console.log("ficha.json salvo!");
}
run();
