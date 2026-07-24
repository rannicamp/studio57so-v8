const { Client } = require('pg');
const ELO_URL = 'postgresql://postgres:REMOVED_PASSWORD@db.alqzomckjnefsmhusnfu.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const c = new Client({ connectionString: decodeURIComponent(ELO_URL), ssl: SSL });
    await c.connect();
    console.log('=== VERIFICANDO DEPENDÊNCIAS DE ORGANIZAÇÕES ===\n');

    const targetOrgs = [7, 8, 9, 11, 13, 14, 15, 16];
    
    // Lista de tabelas comuns a verificar
    const tables = [
        'cadastro_empresa',
        'contatos',
        'lancamentos',
        'contas_financeiras',
        'empreendimentos',
        'funcionarios',
        'contratos',
        'activities',
        'usuarios'
    ];

    try {
        // Pega as tabelas realmente existentes no schema public
        const { rows: dbTables } = await c.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
        );
        const existingTables = dbTables.map(t => t.table_name);

        for (const orgId of targetOrgs) {
            console.log(`Checando Org ID ${orgId}...`);
            let hasDependencies = false;

            for (const table of tables) {
                if (existingTables.includes(table)) {
                    const query = `SELECT COUNT(*) as cnt FROM public.${table} WHERE organizacao_id = $1`;
                    const { rows } = await c.query(query, [orgId]);
                    const count = parseInt(rows[0].cnt, 10);
                    if (count > 0) {
                        console.log(`   ⚠️ Encontrado ${count} registro(s) na tabela "${table}"`);
                        hasDependencies = true;
                    }
                }
            }

            if (!hasDependencies) {
                console.log(`   ✅ Limpo (Pronto para exclusão)`);
            }
            console.log('');
        }

    } catch (e) {
        console.error('Erro na consulta:', e.message);
    } finally {
        await c.end();
    }
}

run();
