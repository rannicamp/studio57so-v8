require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAlfa() {
    const { data, error } = await supabase.from('empreendimento_anexos').select('nome_arquivo, caminho_arquivo').eq('empreendimento_id', 1).limit(5);
    console.log(data);
}
checkAlfa();
