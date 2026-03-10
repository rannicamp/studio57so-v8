const { Client } = require('pg');
const fs = require('fs');

const PASS = encodeURIComponent('Srbr19010720@');
// Escrevendo no Elo 57 (Produção)
const DESTINO_URL = `postgresql://postgres:${PASS}@db.alqzomckjnefsmhusnfu.supabase.co:5432/postgres`;

async function applyRLSAndFunctions() {
    const client = new Client({ connectionString: DESTINO_URL, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();
        console.log('✅ Conectado ao banco de Destino (Elo 57) para push estrutural...');

        const sqlContent = fs.readFileSync('supabase/clone_exato_rls.sql', 'utf8');
        console.log(`📦 Arquivo SQL lido com sucesso (${sqlContent.length} caracteres). Executando lote...`);

        // Executa todo o dump de uma vez 
        await client.query(sqlContent);

        console.log('✅ DUMP APLICADO COM SUCESSO! RLS e Funções no Elo 57 agora são cópias exatas do Studio.');

    } catch (err) {
        console.error('❌ ERRO NA EXECUÇÃO:', err.message);
    } finally {
        await client.end();
    }
}

applyRLSAndFunctions();
