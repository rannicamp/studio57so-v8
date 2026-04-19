const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function aplicarAuditoria() {
    console.log("Iniciando Correção de DB...");

    const { data: categorias } = await supabase.from('categorias_financeiras').select('*');
    
    const catAlfa = categorias.find(c => c.id === 292);
    console.log("Categoria Alfa Original:", catAlfa);

    // Buscar "Reforma Sônia" em categorias, ou criar
    let catSonia = categorias.find(c => c.nome.toLowerCase().includes('reforma') && c.nome.toLowerCase().includes('sônia'));
    if (!catSonia) {
        console.log("Criando a categoria Reforma Sônia dentro de Receitas...");
        // Descobrir parent id de 1. Receita Bruta (já sei que é 356 a raiz, ou 1.1 Receita de Vendas...)
        let maeReceita = categorias.find(c => c.nome.includes('1. Receita Bruta') || c.nome.includes('1.1 Receita de Vendas'));
        let parentId = maeReceita ? maeReceita.id : 356;
        
        const { data, error } = await supabase.from('categorias_financeiras').insert([{
            nome: 'Reforma Apartamento Sônia',
            tipo: 'Receita',
            parent_id: parentId,
            organizacao_id: 1
        }]).select();
        
        if (error) {
             console.error("Erro criando categoria Sonia", error);
             return;
        }
        catSonia = data[0];
        console.log("Categoria Criada:", catSonia);
    } else {
        console.log("Categoria Sônia já existe:", catSonia);
    }

    // 1. ATUALIZAR TODOS com "Un. 202", "Un. 602", "RESIDENCIAL ALFA" nas Vendas -> para Emp 1 e Cat 292
    const { data: lancsAlfa, error: e1 } = await supabase.from('lancamentos')
        .update({ categoria_id: 292, empreendimento_id: 1 })
        .or('descricao.ilike.%Un. 202%,descricao.ilike.%Un. 602%,descricao.ilike.%RESIDENCIAL ALFA%')
        .eq('categoria_id', 185) // Estavam em Vendas
        .select('id, descricao');
        
    console.log(`Corrigidos ${lancsAlfa?.length} itens para Residencial Alfa.`);

    // 2. ATUALIZAR STUDIO 57 INCORPORAÇÕES - PAGAMENTO COMPLEMENTAR REF JAN26 (Estavam como Vendas 185 e Emp Null)
    const { data: lancsComp, error: e2 } = await supabase.from('lancamentos')
        .update({ categoria_id: 292, empreendimento_id: 1 })
        .ilike('descricao', '%STUDIO 57 INCORPORAÇÕES - PAGAMENTO COMPLEMENTAR%')
        .eq('categoria_id', 185) 
        .select('id, descricao');

    console.log(`Corrigidos ${lancsComp?.length} itens Complementares para Residencial Alfa.`);

    // 3. ATUALIZAR SÔNIA CAMPOS - PROJETO REFORMA (Estavam como Vendas 185 e Emp Null)
    const { data: lancsSonia, error: e3 } = await supabase.from('lancamentos')
        .update({ categoria_id: catSonia.id, empreendimento_id: 2 })
        .ilike('descricao', '%SÔNIA CAMPOS - PROJETO REFORMA%')
        .eq('categoria_id', 185) 
        .select('id, descricao');

    console.log(`Corrigidos ${lancsSonia?.length} itens para Reforma Apto Sônia.`);

    console.log("Limpeza finalizada.");
}
aplicarAuditoria();
