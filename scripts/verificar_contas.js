const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarContas() {
    const { data: contas, error } = await supabase
        .from('contas_financeiras')
        .select('id, nome, tipo, organizacao_id')
        .order('id');
        
    if (error) {
        console.error("Erro ao buscar contas:", error);
        return;
    }
    
    console.log(`Foram encontradas ${contas.length} contas.`);
    console.table(contas);
    
    const contasPassivos = contas.filter(c => c.tipo === 'Conta de Passivo');
    console.log("\nContas do tipo Passivo:");
    console.table(contasPassivos);
    
    const tipos = [...new Set(contas.map(c => c.tipo))];
    console.log("\nTipos diferentes na tabela: ", tipos);
}

verificarContas();
