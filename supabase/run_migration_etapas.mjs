import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, 'migrations', '20260314150000_elementos_bim_heranca_etapas.sql');
const sqlContent = readFileSync(sqlPath, 'utf-8');

async function execute() {
    console.log('🚀 Executando Migration de Herança de Etapas...');
    let { data, error } = await supabase.rpc('exec_sql', { query: sqlContent });
    if (error && error.message.includes('Could not find')) {
        let res = await supabase.rpc('exec_sql_admin', { sql: sqlContent });
        error = res.error;
    }

    if (error) console.log('❌ Erro na Migration:', error.message);
    else console.log('✅ Migration aplicada com sucesso!');
}

execute();
