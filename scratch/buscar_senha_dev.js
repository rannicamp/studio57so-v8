const { Client } = require('pg');
const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const c = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await c.connect();

    try {
        console.log('--- BUSCANDO HASH DE SENHA NO DEV ---');
        const { rows } = await c.query(`
            SELECT id, email, encrypted_password 
            FROM auth.users 
            WHERE email = 'anacarolinamvargas@outlook.com'
        `);
        console.log(rows);

    } catch (e) {
        console.error('Erro:', e.message);
    } finally {
        await c.end();
    }
}

run();
