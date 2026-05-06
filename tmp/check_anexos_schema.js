require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
    const { data, error } = await supabase.from('empreendimento_anexos').select('*').limit(1);
    if (error) {
        console.error("Erro ao consultar empreendimento_anexos:", error.message);
    } else {
        console.log("Campos em empreendimento_anexos:", Object.keys(data[0] || {}));
    }
}
checkSchema();
