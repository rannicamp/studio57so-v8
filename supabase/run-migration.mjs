import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, 'migrate-fatura-cartao.sql');
const sqlContent = readFileSync(sqlPath, 'utf-8');

// Executa cada instrução SQL separadamente
const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`🚀 Executando ${statements.length} instruções SQL...\n`);

let successCount = 0;
let errorCount = 0;

for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.slice(0, 60).replace(/\n/g, ' ');

    try {
        const { data, error } = await supabase.rpc('exec_sql_admin', { sql: stmt + ';' });

        if (error) {
            // Tenta via query direta se a RPC não existir
            console.log(`  [${i + 1}] ⚠️  RPC exec_sql_admin não encontrada. Tentando exec_sql...`);

            const { error: e2 } = await supabase.rpc('exec_sql', { query: stmt + ';' });
            if (e2) {
                console.log(`  [${i + 1}] ❌ Erro: ${e2.message.slice(0, 100)}`);
                console.log(`         SQL: ${preview}...`);
                errorCount++;
            } else {
                console.log(`  [${i + 1}] ✅ OK: ${preview}...`);
                successCount++;
            }
        } else {
            console.log(`  [${i + 1}] ✅ OK: ${preview}...`);
            successCount++;
        }
    } catch (err) {
        console.log(`  [${i + 1}] ❌ Exceção: ${err.message.slice(0, 100)}`);
        errorCount++;
    }
}

console.log(`\n📊 Resultado: ${successCount} com sucesso, ${errorCount} erros`);

if (errorCount > 0) {
    console.log('\n⚠️ Alguns erros precisarão ser aplicados manualmente no SQL Editor do Supabase.');
    console.log('📄 Arquivo SQL pronto em: supabase/migrate-fatura-cartao.sql');
}
