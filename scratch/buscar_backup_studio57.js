const { Client } = require('pg');
const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const c = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await c.connect();
    console.log('=== CONECTADO AO BANCO DE DESENVOLVIMENTO (STUDIO 57) ===\n');

    try {
        console.log('--- BUSCANDO ORGANIZAÇÕES ---');
        const { rows: orgs } = await c.query('SELECT * FROM public.organizacoes');
        console.log(orgs);

        console.log('\n--- BUSCANDO USUÁRIO ANA CAROLINA ---');
        const { rows: users } = await c.query(`
            SELECT id, email, nome, organizacao_id, is_superadmin 
            FROM public.usuarios 
            WHERE email = 'studio57.aux2@hotmail.com' OR nome ILIKE '%Ana%' OR nome ILIKE '%Vargas%'
        `);
        console.log(users);

        console.log('\n--- TODOS OS USUÁRIOS E SUAS ORGS NO STUDIO 57 ---');
        const { rows: allUsers } = await c.query(`
            SELECT id, email, nome, organizacao_id, is_superadmin 
            FROM public.usuarios 
            ORDER BY organizacao_id
        `);
        console.log(allUsers);

    } catch (e) {
        console.error('Erro na consulta:', e.message);
    } finally {
        await c.end();
    }
}

run();
