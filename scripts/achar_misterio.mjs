import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Buscando valores misteriosos em TODA a tabela de lancamentos...');
    
    // Convertendo para Float para busca global em SQL não é fácil com =, vamos trazer tudo e filtrar JS 
    // ou usar OR no SQL
    const val1 = 25984;
    const val2 = 26970.74;

    const { data, error } = await supabase.from('lancamentos')
        .select('id, valor, tipo, descricao, data_vencimento, conta_id, contas_financeiras(nome)')
        .or(`valor.eq.${val1},valor.eq.-${val1},valor.eq.${val2},valor.eq.-${val2}`);

    if (error) console.error(error);
    
    console.log(JSON.stringify(data, null, 2));

    // Caçando pelo valor Bruto do Sicoob que tb não achou a despesa: 20386.36
    const val3 = 20386.36;
    const { data: d3 } = await supabase.from('lancamentos')
        .select('id, valor, tipo, descricao, data_vencimento, conta_id, contas_financeiras(nome)')
        .or(`valor.eq.${val3},valor.eq.-${val3}`);
    
    console.log("\nCaçando 20386.36:");
    console.log(JSON.stringify(d3, null, 2));
}

check();
