const { Client } = require('pg');
const PROD_URL = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;

async function main() {
    const client = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    const res = await client.query(`
        SELECT routine_definition 
        FROM information_schema.routines 
        WHERE routine_name = 'get_user_conversations';
    `);
    console.log(res.rows[0]?.routine_definition);
    await client.end();
}
main();
