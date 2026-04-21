const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fetchFeedbacks() {
    const { data: feedbacks, error } = await supabase
        .from('feedback')
        .select(`
            id, status, created_at, pagina, descricao, anexo_url, diagnostico, plano_solucao, comentarios,
            usuario_id
        `)
        .in('status', ['Novo', 'Em Análise'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching feedbacks:', error);
        return;
    }

    // Since 'usuarios' table might be fetched via another query
    for (let f of feedbacks) {
        if (f.usuario_id) {
            const { data: user } = await supabase.from('usuarios').select('nome').eq('id', f.usuario_id).single();
            f.autor_nome = user ? user.nome : 'Unknown';
        }
    }

    fs.writeFileSync('feedbacks_raw.json', JSON.stringify(feedbacks, null, 2));
    console.log('Fetched ' + feedbacks.length + ' pending feedbacks.');
}

fetchFeedbacks().catch(console.error);
