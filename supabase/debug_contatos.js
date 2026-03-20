const { Client } = require('pg');

const PASS = 'Srbr19010720%40';
const STUDIO_URL = `postgresql://postgres:${PASS}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;
const SSL = { rejectUnauthorized: false };

async function debugObject() {
    console.log('Extraindo a lista completa de colunas da tabela contatos...');
    const client = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await client.connect();
    
    try {
        const { rows } = await client.query(`
            SELECT *
            FROM contatos 
            ORDER BY created_at DESC LIMIT 1
        `);
        console.log('\n--- CHAVES DISPONÍVEIS NA TABELA ---');
        console.log(Object.keys(rows[0]));
        
        console.log('\n--- EXIBINDO OS MAIS RECENTES DA ORG 2 ---');
        const org2 = await client.query(`
            SELECT * FROM contatos WHERE organizacao_id = 2 ORDER BY created_at DESC LIMIT 5
        `);
        console.log(JSON.stringify(org2.rows, null, 2));

    } catch(err) {
        console.error('Falha:', err.message);
    }
    await client.end();
}

debugObject().catch(console.error);
