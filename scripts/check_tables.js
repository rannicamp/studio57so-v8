const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function check() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await supabase.rpc('execute_sql', { query: `SELECT table_name FROM information_schema.tables WHERE table_schema='public';` });
    console.log(data);
}
check();
