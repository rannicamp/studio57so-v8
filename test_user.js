const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function test() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    console.log("Auth users:", authUsers?.users?.map(u => ({ id: u.id, email: u.email }))?.filter(u => u.email === 'rannierecampos1@gmail.com'));
    
    const { data, error } = await supabase.from('usuarios').select('*').eq('email', 'rannierecampos1@gmail.com');
    console.log("DB Usuario:", data);
}

test();
