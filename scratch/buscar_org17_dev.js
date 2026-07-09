const { Client } = require('pg');
const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const c = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await c.connect();
    console.log('=== DADOS DA ORG 17 NO DEV ===\n');

    try {
        const { rows: orgs } = await c.query('SELECT * FROM public.organizacoes WHERE id = 17');
        console.log('Org 17:', orgs);

        const { rows: users } = await c.query("SELECT * FROM public.usuarios WHERE organizacao_id = '17'");
        console.log('Users Org 17:', users);

        const { rows: emps } = await c.query("SELECT * FROM public.cadastro_empresa WHERE organizacao_id = '17'");
        console.log('Empresas Org 17:', emps);

    } catch (e) {
        console.error('Erro:', e.message);
    } finally {
        await c.end();
    }
}

run();
