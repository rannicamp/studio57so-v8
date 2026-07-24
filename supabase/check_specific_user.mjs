import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const email = 'rannierecampos1@studio57.arq.br';
    try {
        await client.connect();
        console.log(`🔌 Buscando usuário com e-mail: ${email}`);

        const res = await client.query(`
            SELECT u.id, u.nome, u.email, u.organizacao_id, u.is_superadmin, u.funcao_id, o.nome as nome_org, o.subscription_status, o.subscription_expires_at, o.trial_ends_at
            FROM public.usuarios u
            LEFT JOIN public.organizacoes o ON o.id = u.organizacao_id
            WHERE LOWER(u.email) = LOWER($1);
        `, [email]);

        if (res.rows.length > 0) {
            console.log('\n📊 DADOS DO USUÁRIO NO BANCO:');
            console.table(res.rows);
        } else {
            console.log(`❌ Usuário com e-mail ${email} não encontrado no banco.`);
            // Buscar usuários parecidos
            const resLike = await client.query(`
                SELECT email, nome, organizacao_id, is_superadmin 
                FROM public.usuarios 
                WHERE email LIKE '%ranni%' OR email LIKE '%studio57.arq.br%'
                LIMIT 5;
            `);
            console.log('\n🔍 Usuários sugeridos:');
            console.table(resLike.rows);
        }

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await client.end();
    }
}

main();
