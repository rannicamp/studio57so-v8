import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data, error } = await supabase.rpc('get_column_info', {
      ptable: 'lancamentos'
    }).catch(() => ({data: null}));
    
    // Se não tiver a rpc, vamos buscar direto via query na pg_typeof ou inserindo um erro
    const { data: cols, error: err } = await supabase
      .from('lancamentos')
      .select('valor')
      .limit(1);

    if (cols && cols.length > 0) {
      console.log('Valor typeof in JS:', typeof cols[0].valor);
    }
}
main().catch(console.error);
