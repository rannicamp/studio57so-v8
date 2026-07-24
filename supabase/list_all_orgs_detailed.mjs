import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log('🔌 Conectado ao banco de dados Supabase!');

        // Query detalhada para trazer as organizações, quantidade de usuários e contatos associados
        const query = `
            SELECT 
                o.id, 
                o.nome AS nome_organizacao, 
                o.created_at AS data_criacao,
                o.subscription_status AS status_assinatura,
                (SELECT COUNT(*) FROM public.usuarios u WHERE u.organizacao_id = o.id) AS qtd_usuarios,
                COALESCE(
                    (
                        SELECT STRING_AGG(u.nome || ' (' || u.email || ')', ' | ') 
                        FROM (
                            SELECT nome, email 
                            FROM public.usuarios 
                            WHERE organizacao_id = o.id 
                            LIMIT 3
                        ) u
                    ), 
                    'SEM USUÁRIOS'
                ) AS membros
            FROM public.organizacoes o
            ORDER BY o.id ASC;
        `;

        const res = await client.query(query);
        console.log('\n📊 INVENTÁRIO DETALHADO DE ORGANIZAÇÕES NO BANCO DE DADOS:');
        console.table(res.rows);

        // Também gerar formato JSON formatado para facilitar a leitura no console se necessário
        const jsonOutput = JSON.stringify(res.rows, null, 2);
        console.log('\n✏️ JSON das Organizações:');
        console.log(jsonOutput);

    } catch (err) {
        console.error('❌ Erro ao listar organizações:', err.message);
    } finally {
        await client.end();
    }
}

main();
