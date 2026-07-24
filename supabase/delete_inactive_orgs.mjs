import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`,
    ssl: { rejectUnauthorized: false }
});

const ORGS_TO_DELETE = [7, 12, 13, 14, 16, 18, 19, 20];

async function main() {
    try {
        await client.connect();
        console.log('🔌 Conectado ao banco de dados Supabase para remoção segura...');

        // Iniciar transação para garantir atomicidade
        await client.query('BEGIN');
        console.log('⏳ Iniciando transação de faxina...');

        // 1. Obter a lista de UUIDs dos usuários que pertencem a essas organizações
        const usersRes = await client.query(`
            SELECT id, email, nome 
            FROM public.usuarios 
            WHERE organizacao_id = ANY($1::int[]);
        `, [ORGS_TO_DELETE]);

        const userIds = usersRes.rows.map(u => u.id);
        
        console.log(`\n👥 Encontrados ${usersRes.rows.length} usuários a serem removidos de auth.users:`);
        console.table(usersRes.rows);

        // 2. Se houver usuários, remover primeiro da autenticação do Supabase (auth.users)
        // Isso aciona triggers de limpeza de perfil automaticamente no Supabase
        if (userIds.length > 0) {
            console.log('⏳ Deletando usuários da tabela de autenticação auth.users...');
            await client.query(`
                DELETE FROM auth.users 
                WHERE id = ANY($1::uuid[]);
            `, [userIds]);
            console.log('✅ Usuários removidos do auth.users com sucesso!');
        }

        // 3. Descobrir dinamicamente TODAS as tabelas do schema public que contêm a coluna 'organizacao_id'
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.columns 
            WHERE column_name = 'organizacao_id' 
              AND table_schema = 'public';
        `);

        // Extrai nomes das tabelas únicos e remove 'organizacoes' da lista para ser a última a ser limpa
        const tables = tablesRes.rows
            .map(t => t.table_name)
            .filter((value, index, self) => self.indexOf(value) === index && value !== 'organizacoes');

        console.log(`\n📂 Encontradas ${tables.length} tabelas no banco contendo 'organizacao_id' para limpar.`);

        // 4. Executar DELETE para as organizações em cada uma dessas tabelas
        for (const table of tables) {
            try {
                // Verificar se a tabela possui dados para esses IDs para não poluir os logs com queries vazias
                const checkData = await client.query(`
                    SELECT COUNT(*) as count FROM public.${table} WHERE organizacao_id = ANY($1::int[]);
                `, [ORGS_TO_DELETE]);

                const count = parseInt(checkData.rows[0].count, 10);
                if (count > 0) {
                    console.log(`⏳ Deletando ${count} registros da tabela public.${table}...`);
                    await client.query(`
                        DELETE FROM public.${table} 
                        WHERE organizacao_id = ANY($1::int[]);
                    `, [ORGS_TO_DELETE]);
                }
            } catch (err) {
                console.error(`⚠️ Erro ao tentar limpar tabela public.${table}:`, err.message);
                // Dependendo da FK, se der erro em alguma tabela específica, mostramos o erro mas prosseguimos se possível, 
                // ou se for crítico, a transação dará rollback.
            }
        }

        // 5. Por fim, deletar as organizações da tabela public.organizacoes
        console.log('\n⏳ Removendo as organizações da tabela public.organizacoes...');
        const deleteOrgsRes = await client.query(`
            DELETE FROM public.organizacoes 
            WHERE id = ANY($1::int[]);
        `, [ORGS_TO_DELETE]);
        console.log(`✅ ${deleteOrgsRes.rowCount} organizações excluídas com sucesso!`);

        // Commitar transação
        await client.query('COMMIT');
        console.log('\n🎉 Transação finalizada e dados salvos no banco com sucesso!');

    } catch (err) {
        // Rollback se der erro
        await client.query('ROLLBACK');
        console.error('\n❌ ERRO CRÍTICO NA FAXINA (Transação desfeita com ROLLBACK):', err.message);
        if (err.stack) console.error(err.stack);
    } finally {
        await client.end();
        console.log('\n🔌 Conexão encerrada.');
    }
}

main();
