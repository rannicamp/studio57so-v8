const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkJun2025() {
    const { data: lancs, error } = await supabase
        .from('lancamentos')
        .select('id, data_vencimento, data_pagamento, valor, descricao, status, conciliado, categoria_id, tipo')
        .gte('data_pagamento', '2025-06-01')
        .lte('data_pagamento', '2025-06-30')
        .order('data_pagamento', { ascending: true });

    const { data: lancsVenc } = await supabase
        .from('lancamentos')
        .select('id, data_vencimento, data_pagamento, valor, descricao, status, conciliado, categoria_id, tipo')
        .gte('data_vencimento', '2025-06-01')
        .lte('data_vencimento', '2025-06-30')
        .is('data_pagamento', null)
        .order('data_vencimento', { ascending: true });

    const todosJun = [...(lancs || []), ...(lancsVenc || [])];

    let somaReceitaEfetivada = 0;
    
    // Categorias master "Receitas" -> 1. Receita Bruta, 5.1 Receitas Financeiras
    const { data: categorias } = await supabase.from('categorias_financeiras').select('id, nome, tipo');
    const catMap = {};
    categorias.forEach(c => catMap[c.id] = c);

    const itens = [];

    todosJun.forEach(l => {
        const cat = catMap[l.categoria_id];
        if (!cat) return;

        // Is it a Revenue?
        if (cat.tipo === 'Receita') {
            const val = Number(l.valor) || 0;
            const efetivado = l.status === 'Pago' || l.status === 'Recebido' || l.status === 'Conciliado' || l.conciliado === true;
            
            if (efetivado) {
                somaReceitaEfetivada += val;
            }

            const sit = efetivado ? `✅ Recebido` : `⏳ Pendente`;
            itens.push(`| ${l.data_pagamento || l.data_vencimento} | R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits:2})} | [${cat.nome}] ${l.descricao.substring(0, 50)} | ${sit} |`);
        }
    });

    const md = `# Investigação: Junho de 2025 (Receitas)\n\n**Total Apurado (Receitas PAGAS/EFETIVADAS): R$ ${somaReceitaEfetivada.toLocaleString('pt-BR', {minimumFractionDigits: 2})}**\n\n| Data | Valor (R$) | Categoria / Desc. | Situação |\n| --- | --- | --- | --- |\n${itens.join('\n')}`;

    console.log("=== ARTEFATO JUNHO ===");
    console.log(md);
    console.log("=== FIM ARTEFATO ===");
}
checkJun2025();
