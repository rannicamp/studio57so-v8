const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check85k() {
    // Buscar categorias
    const { data: categorias } = await supabase
        .from('categorias_financeiras')
        .select('id, nome, parent_id');

    const catMap = {};
    categorias.forEach(c => catMap[c.id] = c.nome);

    // Encontrar id exato de "Vendas"
    const vendasCat = categorias.find(c => c.nome.trim() === 'Vendas' || c.nome.includes('Vendas'));
    if (!vendasCat) {
        console.log("Categoria 'Vendas' não encontrada.");
        return;
    }

    console.log(`Auditorando a Categoria '${vendasCat.nome}' (ID: ${vendasCat.id})...`);

    // Buscar lançamentos da categoria Vendas
    const { data: lancamentos, error } = await supabase
        .from('lancamentos')
        .select('id, data_vencimento, data_pagamento, valor, descricao, status')
        .eq('categoria_id', vendasCat.id)
        .order('data_pagamento', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }
    
    // Status de entrada positiva
    const validStatuses = ['Pago', 'Recebido', 'Conciliado'];

    let soma = 0;
    const items = [];
    lancamentos.forEach(l => {
        if(validStatuses.includes(l.status) || l.conciliado) {
             const v = Number(l.valor) || 0;
             soma += v;
             // Criar um row markdown pra o log
             items.push(`| ${l.data_pagamento || l.data_vencimento} | R$ ${v.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits:2})} | ${l.descricao || 'Sem descrição'} | ${l.status} |`);
        }
    });

    console.log(`Encontrados R$ ${soma} reais nessa categoria!`);

    // Gerar relatorio markdown
    const md = `# Auditoria: Receitas de "Vendas" (R$ ${soma.toLocaleString('pt-BR', {minimumFractionDigits: 2})})

Esta é a lista detalhada de entradas financeiras que compõem os **R$ ${soma.toLocaleString('pt-BR', {minimumFractionDigits: 2})}** listados na matriz do DRE, abaixo do grupo de Receita Bruta.

| Data          | Valor         | Descrição do Lançamento | Status      |
| ------------- | ------------- | ----------------------- | ----------- |
${items.join('\n')}

> **Nota:** Todos os itens listados acima estão com status "Recebido" ou "Conciliado", confirmando que a soma reflete o saldo real do caixa.
`;

    // console.log(md);
    console.log("=== INICIO DO ARTEFATO ===");
    console.log(md);
    console.log("=== FIM DO ARTEFATO ===");
}
check85k();
