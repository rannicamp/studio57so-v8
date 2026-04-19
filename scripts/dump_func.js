const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function dumpFunc() {
    const password = process.env.SUPABASE_DB_PASSWORD || 'Srbr19010720@';
    const devUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;
    const client = new Client({ connectionString: devUrl, ssl: { rejectUnauthorized: false } });
    
    await client.connect();
    const res = await client.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'financeiro_montar_where';");
    const fs = require('fs');
    fs.writeFileSync('supabase/financeiro_montar_where.sql', res.rows[0].pg_get_functiondef);
    console.log("Salvo em supabase/financeiro_montar_where.sql");
    await client.end();
}
dumpFunc();
