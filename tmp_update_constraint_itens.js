const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function main() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    await prod.connect();
    console.log('✅ Conectado ao PROD');

    try {
        await prod.query(`ALTER TABLE public.pedidos_compra_itens DROP CONSTRAINT IF EXISTS pedidos_compra_itens_tipo_operacao_check;`);
        console.log('✅ Constraint antiga de tipo_operacao removida!');
        
        await prod.query(`ALTER TABLE public.pedidos_compra_itens ADD CONSTRAINT pedidos_compra_itens_tipo_operacao_check CHECK (tipo_operacao IN ('Compra', 'Aluguel', 'Contratação'));`);
        console.log('✅ Nova constraint de tipo_operacao criada!');
    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await prod.end();
    }
}

main();
