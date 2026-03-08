import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

// Carrega as variáveis de ambiente do .env local
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, 'flexibilizar_cadastro.sql');
const sqlContent = readFileSync(sqlPath, 'utf-8');

// Separar em duas execuções
const dropNotNullQuery = `ALTER TABLE public.cadastro_empresa ALTER COLUMN cnpj DROP NOT NULL;`;
const addColumnQuery = `
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'organizacoes'
          AND column_name = 'entidade_principal_id'
    ) THEN
        ALTER TABLE public.organizacoes ADD COLUMN entidade_principal_id bigint;
    END IF;
END $$;
`;

async function execute() {
    console.log('🚀 Executando Flexibilização do Cadastro...');

    // Como estamos testando, algumas vezes o query pode precisar de exec_sql ou apenas de uma chamada REST indireta
    // Vamos usar uma call para tabela que sabemos que existe ou apenas a RPC
    let { error: e1 } = await supabase.rpc('exec_sql', { query: dropNotNullQuery });
    if (e1 && e1.message.includes('Could not find')) {
        let { error: e1Alt } = await supabase.rpc('exec_sql_admin', { sql: dropNotNullQuery });
        e1 = e1Alt;
    }

    if (e1) console.log('❌ Erro Drop Not Null:', e1.message);
    else console.log('✅ CNPJ flexibilizado.');

    let { error: e2 } = await supabase.rpc('exec_sql', { query: addColumnQuery });
    if (e2 && e2.message.includes('Could not find')) {
        let { error: e2Alt } = await supabase.rpc('exec_sql_admin', { sql: addColumnQuery });
        e2 = e2Alt;
    }

    if (e2) console.log('❌ Erro Create Column:', e2.message);
    else console.log('✅ Coluna Entidade Principal garantida.');

}

execute();
