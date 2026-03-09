import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from the Next.js .env.local file
const envPath = path.resolve('C:\\Projetos\\studio57so-v8\\.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase URL or Key not found in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeContasSchema() {
    console.log('Analyzing "contas" table schema and sample data...');

    // Try to get a single row to see all columns
    const { data, error } = await supabase
        .from('contas_financeiras')
        .select('id, nome, instituicao, codigo_banco_ofx, agencia, numero_conta')
        .limit(10);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Available columns in the "contas" table:');
        const columns = Object.keys(data[0]);
        columns.forEach(col => console.log(` - ${col} (${typeof data[0][col]})`));

        console.log('\nSample row data:');
        console.log(JSON.stringify(data[0], null, 2));
    } else {
        console.log('Table is accessible but currently empty.');
    }
}

analyzeContasSchema();
