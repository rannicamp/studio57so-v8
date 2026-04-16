// scripts/injetar_rpc_absenteismo.js
// USO: node scripts/injetar_rpc_absenteismo.js SUA_SENHA_DO_BANCO

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
            const match = fs.readFileSync('.env.db', 'utf8').match(/SUPABASE_DB_PASSWORD=(.+)/);
            if (match) return match[1].trim();
        }
    } catch { }
    return null;
}

async function run() {
    const password = getPassword();
    if (!password) {
        console.error('\n❌ SENHA NÃO ENCONTRADA!');
        process.exit(1);
    }

    const host = `db.${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace('https://', '').split('.')[0]}.supabase.co`;
    const client = new Client({ connectionString: `postgres://postgres:${password}@${host}:6543/postgres`, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();
        const sqlContent = fs.readFileSync('db_rpc_absenteismo.sql', 'utf8');
        const cleanSQL = sqlContent.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim();

        console.log('⚙️  Injetando RPC get_rh_tendencia_absenteismo...');
        await client.query(cleanSQL);
        console.log('✅ RPC criada com sucesso!\n');

        console.log('🧪 Testando a RPC...');
        const { rows } = await client.query("SELECT get_rh_tendencia_absenteismo('2026', 1) as resultado");
        console.log('✅ Retornou:', JSON.stringify(rows[0]?.resultado[0], null, 2));

    } catch (e) {
        console.error('❌ Erro:', e.message);
    } finally {
        await client.end();
    }
}

run();
