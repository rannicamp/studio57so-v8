const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function verificarId351() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: c } = await supabase.from('categorias_financeiras').select('*').eq('id', 351).single();
    console.log("=== CATEGORIA 351 ===");
    console.log(c);

    // E ver onde a RPC devolve ela
    const { data: res } = await supabase.rpc('dre_matriz_agrupada_obras', {
        p_organizacao_id: 2,
        p_filtros: { requireObra: false }
    });
    
    if (res) {
        let filtro = res.filter(r => r.categoria_id == 351);
        console.log("=== MATRIZ DB para 351 ===");
        console.log(filtro);
    }
}
verificarId351();
