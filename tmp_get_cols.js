const { Client } = require('pg');
const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
async function main() {
    const client = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: { rejectUnauthorized: false } });
    await client.connect();
    const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'whatsapp_list_members';`);
    console.log(res.rows);
    await client.end();
}
main();
