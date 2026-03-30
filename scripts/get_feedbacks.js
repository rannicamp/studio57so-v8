require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function getFeedbacks() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    
    // Fetch feedbacks including author info
    const { data: feedbacks, error } = await supabase
        .from('feedback')
        .select('*')
        .in('status', ['Novo', 'Em Análise'])
        .or('diagnostico.is.null,diagnostico.eq.""');
        
    if (error) {
        console.error("Error fetching feedbacks:", error);
        return;
    }
    
    console.log("Found", feedbacks.length, "pending feedbacks.");
    
    // Fetch names manually due to cross-table joins being complex with RLS/Auth
    for (let f of feedbacks) {
        if (f.usuario_id) {
            const { data: user } = await supabase.from('funcionarios').select('nome').eq('usuario_id', f.usuario_id).maybeSingle();
            f.autor = user ? user.nome : f.usuario_id;
        } else {
            f.autor = "Unknown";
        }
        if (f.organizacao_id) {
            const { data: org } = await supabase.from('cadastro_empresa').select('nome_fantasia, razao_social').eq('id', f.organizacao_id).maybeSingle();
            f.organizacao = org ? (org.nome_fantasia || org.razao_social) : f.organizacao_id;
        } else {
            f.organizacao = "Unknown";
        }
    }
    
    const fs = require('fs');
    fs.writeFileSync('./scripts/pending_feedbacks.json', JSON.stringify(feedbacks, null, 2));
    console.log("Saved pending_feedbacks.json");
}

getFeedbacks();
