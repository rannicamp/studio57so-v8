const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function applySQL() {
    const sql = fs.readFileSync('supabase/get_almoxarifado_kpis.sql', 'utf8');
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
        console.error("Error executing SQL:", error);
    } else {
        console.log("SQL executed successfully.");
    }
}

applySQL();
