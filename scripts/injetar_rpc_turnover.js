// scripts/injetar_rpc_turnover.js
// Usa o mesmo padrão do sql_runner.js para injetar a RPC de Turnover
// USO: node scripts/injetar_rpc_turnover.js SUA_SENHA_DO_BANCO

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

function getPassword() {
    const argPassword = process.argv[2];
    if (argPassword && argPassword.length > 5) return argPassword;
    if (process.env.SUPABASE_DB_PASSWORD) return process.env.SUPABASE_DB_PASSWORD;
    if (process.env.DB_PASSWORD) return process.env.DB_PASSWORD;
    if (process.env.POSTGRES_PASSWORD) return process.env.POSTGRES_PASSWORD;
    try {
        if (fs.existsSync('.env.db')) {
            const dbEnv = fs.readFileSync('.env.db', 'utf8');
            const match = dbEnv.match(/SUPABASE_DB_PASSWORD=(.+)/);
            if (match) return match[1].trim();
        }
    } catch { }
    return null;
}

async function run() {
    const password = getPassword();
    if (!password) {
        console.error('\n❌ SENHA NÃO ENCONTRADA!');
        console.error('  Use: node scripts/injetar_rpc_turnover.js SUA_SENHA');
        console.error('  Pegue em: Supabase Dashboard → Settings → Database → Database password\n');
        process.exit(1);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const baseHost = supabaseUrl.replace('https://', '').split('/')[0];
    const projectId = baseHost.split('.')[0];
    const host = `db.${projectId}.supabase.co`;
    const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

    const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

    try {
        console.log(`🔌 Conectando a ${host}:6543...`);
        await client.connect();
        console.log('✅ Conectado!\n');

        // Lê o arquivo SQL que já criamos
        const sqlContent = fs.readFileSync('db_rpc_turnover.sql', 'utf8');
        // Remove linhas de comentário SQL (-- ...)
        const cleanSQL = sqlContent.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim();

        console.log('⚙️  Injetando RPC get_rh_tendencia_turnover...');
        await client.query(cleanSQL);
        console.log('✅ RPC criada com sucesso!\n');

        // Teste rápido
        console.log('🧪 Testando a RPC com ano 2026, org 1...');
        const { rows } = await client.query("SELECT get_rh_tendencia_turnover('2026', 1) as resultado");
        const resultado = rows[0]?.resultado;
        if (resultado && resultado.length > 0) {
            console.log(`✅ Retornou ${resultado.length} meses de dados!`);
            console.log('   Amostra (Jan):', JSON.stringify(resultado[0], null, 2));
        } else {
            console.log('⚠️  Retornou vazio (pode ser que org 1 não tenha funcionários com jornada)');
        }

        console.log('\n🎉 Operação concluída com sucesso!');
    } catch (e) {
        console.error('❌ Erro:', e.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Conexão encerrada.');
    }
}

run();
