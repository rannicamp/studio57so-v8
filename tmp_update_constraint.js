const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function main() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    await prod.connect();
    console.log('✅ Conectado ao PROD');

    try {
        await prod.query(`ALTER TABLE public.materiais DROP CONSTRAINT IF EXISTS materiais_classificacao_check;`);
        console.log('✅ Constraint antiga removida!');
        
        await prod.query(`ALTER TABLE public.materiais ADD CONSTRAINT materiais_classificacao_check CHECK (classificacao IN ('Insumo', 'Equipamento', 'Serviço', 'Insumo (Consumível)', 'Equipamento (Retornável)'));`);
        console.log('✅ Nova constraint criada!');
    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await prod.end();
    }
}

main();
