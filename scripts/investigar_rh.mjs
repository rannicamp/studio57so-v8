import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("=== LENDO TODOS OS DADOS DO LANCAMENTO 10586 ===");
    const { data: lancamento, error } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('id', 10586);

    console.log(lancamento);
}

main().catch(console.error);
