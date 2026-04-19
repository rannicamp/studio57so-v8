const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function deployFunction() {
    const password = process.env.SUPABASE_DB_PASSWORD || 'Srbr19010720@';
    const devUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;
    const client = new Client({ connectionString: devUrl, ssl: { rejectUnauthorized: false } });
    
    console.log("Conectando PG...");
    await client.connect();
    
    const sql = fs.readFileSync('supabase/financeiro_montar_where.sql', 'utf8');
    
    console.log("Aplicando financeiro_montar_where.sql...");
    await client.query(sql);
    
    console.log("Notificando pgrst para atualizar cache RPC...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    
    console.log("Deploy concluído!");
    await client.end();
}
deployFunction();
