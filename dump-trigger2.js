const fs = require('fs');
const { Client } = require('pg');
const PROD_URL = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;

async function main() {
    const db = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: { rejectUnauthorized: false } });
    await db.connect();
    const res = await db.query(`SELECT pg_get_functiondef('fn_vincular_lancamento_fatura'::regproc)`);
    fs.writeFileSync('trigger.sql', res.rows[0].pg_get_functiondef);
    await db.end();
}
main().catch(console.error);
