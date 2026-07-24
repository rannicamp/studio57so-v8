const { Client } = require('pg');
const ELO_URL = 'postgresql://postgres:REMOVED_PASSWORD@db.alqzomckjnefsmhusnfu.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const c = new Client({ connectionString: decodeURIComponent(ELO_URL), ssl: SSL });
    await c.connect();

    try {
        console.log('--- TODAS AS FUNÇÕES ---');
        const { rows } = await c.query('SELECT * FROM public.funcoes ORDER BY id::int');
        console.log(rows);

    } catch (e) {
        console.error('Erro:', e.message);
    } finally {
        await c.end();
    }
}

run();
