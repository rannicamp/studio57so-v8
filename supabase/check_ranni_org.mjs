import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log('✅ Conectado ao banco de dados!');

        // 1. Listar os usuários cadastrados com suas organizações e cargo
        const resUsers = await client.query(`
            SELECT u.id, u.nome, u.email, u.organizacao_id, u.is_superadmin, u.funcao_id, o.nome as nome_org, o.subscription_status
            FROM public.usuarios u
            LEFT JOIN public.organizacoes o ON o.id = u.organizacao_id
            ORDER BY u.created_at DESC
            LIMIT 20;
        `);
        console.log('\n📊 USUÁRIOS RECENTES NO BANCO DE DADOS:');
        console.table(resUsers.rows);

        // 2. Verificar quais organizações possuem status 'overdue'
        const resOrgs = await client.query(`
            SELECT id, nome, subscription_status, trial_ends_at, subscription_expires_at
            FROM public.organizacoes
            ORDER BY id ASC;
        `);
        console.log('\n📊 TODAS AS ORGANIZAÇÕES E STATUS DE ASSINATURA:');
        console.table(resOrgs.rows);

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await client.end();
    }
}

main();
