const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkDiff() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: categorias } = await supabase.from('categorias_financeiras').select('*');
    
    let rootCategory = categorias.find(c => c.nome.toLowerCase().includes('custo') && c.nome.toLowerCase().includes('obra'));
    if (!rootCategory) {
        rootCategory = categorias.find(c => c.nome.startsWith('3.'));
    }
    
    console.log("ROOT:", rootCategory.id, rootCategory.nome);
    
    const estornos = categorias.filter(c => c.nome.toLowerCase().includes('estorno'));
    estornos.forEach(e => {
        let parent = categorias.find(c => c.id === e.parent_id);
        console.log("ESTORNO CAT:", e.id, e.nome, "Parent:", e.parent_id, (parent ? parent.nome : 'Nenhum'));
        
        let path = e.nome;
        let curr = parent;
        while(curr) {
            path = curr.nome + ' > ' + path;
            curr = categorias.find(c => c.id === curr.parent_id);
        }
        console.log("PATH:", path);
    });
}
checkDiff();
