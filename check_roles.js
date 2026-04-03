const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkRoles() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: funcoes } = await supabase.from('funcoes').select('*').order('id', { ascending: true });
    console.log("Funções Disponíveis:", funcoes);
}

checkRoles();
