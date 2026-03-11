import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
    console.log("Checking banco_arquivos_ofx...");
    const { data: arquivos, error: err1 } = await supabase
        .from('banco_arquivos_ofx')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
        
    if (err1) {
        console.error("Error fetching arquivos:", err1);
        return;
    }
    console.log("ARQUIVO RECENTE:");
    console.log(JSON.stringify(arquivos[0], null, 2));

    if (arquivos.length > 0) {
        const { data: transacoes, error: err2 } = await supabase
            .from('banco_transacoes_ofx')
            .select('*')
            .eq('arquivo_id', arquivos[0].id);
            
        if (err2) {
            console.error("Error fetching transacoes:", err2);
        } else {
            console.log("TRANSACOES:");
            console.log(JSON.stringify(transacoes, null, 2));
        }
    }
}

checkDatabase();
