const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('funcionarios')
        .select(`
            id, full_name, foto_url, status, cpf,
            cargos (id, nome), cadastro_empresa(id, razao_social)
        `);
    
    if (error) {
        console.error("ERRO:", JSON.stringify(error, null, 2));
    } else {
        console.log("SUCESSO: Temos", data.length, "funcionários!");
        console.log("cadastro_empresa:", data[0].cadastro_empresa);
    }
}

check();
