const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // 188: Empréstimo sócios
    // 300: Empréstimos bancários
    // 371: Empréstimo terceiros
    
    // Updates
    const updates = [
        { ids: [6517, 6487, 6475, 6806, 16952, 11878, 13880, 17083], categoria_id: 188 }, // IGOR = Socios
        { ids: [5190, 11939, 16953], categoria_id: 300 }, // Caixa, GiroCaixa, Sicoob = Bancarios
        { ids: [16950, 17084], categoria_id: 371 }  // Alsenir = Terceiros
    ];
    
    for (const group of updates) {
        const { data, error } = await supabase
            .from('lancamentos')
            .update({ categoria_id: group.categoria_id })
            .in('id', group.ids);
            
        if (error) {
            console.error("Erro update IDs:", group.ids, error.message);
        } else {
            console.log(`Atualizadas categorias para IDs [${group.ids.join(',')}] -> Cat: ${group.categoria_id}`);
        }
    }
}
run();
