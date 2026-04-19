const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cats } = await supabase.from('categorias_financeiras').select('id, nome').ilike('nome', '%Empr%sti%');
    const catIds = cats?.map(c => c.id) || [];
    
    const { data: lancamentos, error } = await supabase
        .from('lancamentos')
        .select(`
            id,
            descricao,
            valor,
            tipo,
            status,
            data_vencimento,
            data_pagamento,
            categorias_financeiras(nome),
            contatos(nome, razao_social)
        `)
        .in('categoria_id', catIds)
        .eq('tipo', 'Receita')
        .order('data_vencimento', { ascending: false });
        
    if (error) { console.error(error); return; }
    
    let csv = '\uFEFFID;Data;Favorecido;Descrição;Categoria;Tipo;Status;Valor\n';
    lancamentos.forEach(i => {
        let fav = i.contatos ? (i.contatos.nome || i.contatos.razao_social || '-') : '-';
        csv += `${i.id};${i.data_vencimento};${fav};${i.descricao?.replace(/;/g, ',')};${i.categorias_financeiras?.nome};${i.tipo};${i.status};${i.valor}\n`;
    });
    fs.writeFileSync('relatorio_emprestimos_receitas.csv', csv);
    
    fs.writeFileSync('scripts/tmp_receitas.json', JSON.stringify(lancamentos, null, 2));
    console.log("Receitas geradas: ", lancamentos.length);
}
run();
