const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PASS = 'Srbr19010720%40';
const STUDIO_URL = `postgresql://postgres:${PASS}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;
const ELO_URL = `postgresql://postgres:${PASS}@db.alqzomckjnefsmhusnfu.supabase.co:5432/postgres`;
const SSL = { rejectUnauthorized: false };

async function install() {
    console.log('Iniciando instalacao...');
    const client = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await client.connect();
    
    // Lê a função local
    const sqlFile = fs.readFileSync(path.join(__dirname, 'rpc_fn_relatorio_comercial.sql'), 'utf8');
    
    console.log('Rodando query no banco do Studio 57...');
    try {
        await client.query(sqlFile);
        console.log('✅ SUCESSO! A RPC fn_relatorio_comercial foi plantada.');
    } catch(err) {
        console.error('❌ ERRO AO CRIAR RPC:', err.message);
    }

    await client.end();
}

install().catch(console.error);
