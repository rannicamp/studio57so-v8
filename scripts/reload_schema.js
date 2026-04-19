const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function reloadCache() {
    const password = process.env.SUPABASE_DB_PASSWORD || 'Srbr19010720@';
    const devUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;
    const client = new Client({ connectionString: devUrl, ssl: { rejectUnauthorized: false } });
    
    console.log("Conectando PG pra dar Refresh no Cache do Supabase API...");
    await client.connect();
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("Comando enviado!");
    await client.end();
}
reloadCache();
