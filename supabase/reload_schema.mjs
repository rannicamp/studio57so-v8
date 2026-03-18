import pg from 'pg';
const { Client } = pg;

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';

const client = new Client({
    connectionString: decodeURIComponent(PROD_URL),
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log('✅ Conectado ao banco!');
        
        console.log('⏳ Recarregando o cache do schema do Supabase (PostgREST)...');
        await client.query(`NOTIFY pgrst, 'reload schema';`);
        console.log('✅ Cache recarregado com sucesso! O erro de coluna não encontrada deve desaparecer.');
    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await client.end();
        console.log('🔌 Concluído!');
    }
}

run();
