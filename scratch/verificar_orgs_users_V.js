const { Client } = require('pg');
const ELO_URL = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;
const SSL = { rejectUnauthorized: false };

async function run() {
    const c = new Client({ connectionString: decodeURIComponent(ELO_URL), ssl: SSL });
    await c.connect();
    console.log('=== CONECTADO AO BANCO V (vhuvnutzklhskkwbpxdz) ===\n');

    try {
        console.log('--- BUSCANDO TODAS AS ORGANIZAÇÕES ---');
        const { rows: orgs } = await c.query('SELECT id, nome, created_at FROM public.organizacoes ORDER BY id::int');
        console.log(orgs);

        console.log('\n--- BUSCANDO TODOS OS USUÁRIOS E SUAS ORGS ---');
        const { rows: users } = await c.query('SELECT id, email, nome, organizacao_id, is_superadmin FROM public.usuarios');
        console.log(users);

    } catch (e) {
        console.error('Erro na consulta:', e.message);
    } finally {
        await c.end();
    }
}

run();
