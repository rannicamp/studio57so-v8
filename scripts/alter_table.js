const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runAlter() {
    const password = process.env.SUPABASE_DB_PASSWORD || 'Srbr19010720@'; // Defaulting just in case, based on check-elo.js
    const encodedPassword = encodeURIComponent(password);

    // Conectando no banco Studio 57 (Dev)
    const DEV_URL = `postgresql://postgres:${encodedPassword}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;
    // fallback se não usar pooler
    const DEV_URL_DIRECT = `postgresql://postgres:${encodedPassword}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;

    console.log("Conectando ao banco de dados...");

    const client = new Client({
        connectionString: DEV_URL_DIRECT,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log("Executando ALTER TABLE colunas_funil ADD COLUMN IF NOT EXISTS tipo_coluna TEXT...");
        await client.query('ALTER TABLE colunas_funil ADD COLUMN IF NOT EXISTS tipo_coluna TEXT;');
        console.log("✅ Coluna tipo_coluna adicionada com sucesso no Studio 57 (DEV)!");

    } catch (e) {
        console.error("Erro ao alterar o banco:", e);
    } finally {
        await client.end();
    }
}

runAlter();
