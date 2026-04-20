const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function deployFunction() {
    const password = process.env.SUPABASE_DB_PASSWORD || 'Srbr19010720@';
    const devUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;
    const client = new Client({ connectionString: devUrl, ssl: { rejectUnauthorized: false } });
    
    console.log("Conectando PG...");
    await client.connect();
    
    // Ler os argumentos da linha de comando pra pegar o path do arquivo
    const file = process.argv[2] || 'supabase/get_balanco_patrimonial.sql';
    const sql = fs.readFileSync(file, 'utf8');
    
    console.log(`Aplicando ${file}...`);
    await client.query(sql);
    
    console.log("Notificando pgrst para atualizar cache RPC...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    
    console.log("Deploy concluído!");
    await client.end();
}
deployFunction();
