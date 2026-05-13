const { Client } = require('pg');

const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres';
const SSL = { rejectUnauthorized: false };

async function getFunc() {
    const client = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT pg_get_functiondef(oid)
            FROM pg_proc
            WHERE proname = 'provisionar_parcelas_contrato';
        `);
        console.log(res.rows[0].pg_get_functiondef);
    } catch(e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
getFunc();
