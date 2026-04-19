const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("Iniciando Clonagem Pareada...");

    // Busca os originais
    const { data: originais, error: errFetch } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('conta_id', 28) // Sicoob AC Credi Incorp
        .eq('categoria_id', 351) // Antecipações
        .eq('tipo', 'Receita');
        
    if (errFetch) {
        console.error("Erro na busca:", errFetch);
        return;
    }

    console.log(`Lotes originais encontrados: ${originais.length}`);
    let clones = [];
    
    for (const org of originais) {
        // Criar espelho
        let clone = { ...org };
        delete clone.id; // Remover ID para criação do zero
        delete clone.created_at; 
        delete clone.updated_at;
        
        // Modificações de passivo
        clone.conta_id = 64; // P - ANTECIPAÇÕES
        clone.tipo = 'Despesa'; // Transação de Saída
        // Sinal Negativo forçado
        clone.valor = -Math.abs(clone.valor); 
        
        clones.push(clone);
    }
    
    console.log("Valor acumulado das Despesas que serão lançadas:", clones.reduce((acc, v) => acc + v.valor, 0));
    
    // Inserção em Lote (Bulk Insert)
    const { data: inserted, error: errIns } = await supabase
        .from('lancamentos')
        .insert(clones)
        .select('id, valor, descricao');
        
    if (errIns) {
        console.error("Erro no Insert Batch:", errIns);
    } else {
        console.log(`SUCESSO COMPLETADO! ${inserted.length} transações criadas no Passivo!`);
        inserted.forEach(i => console.log(`Injetado: ID ${i.id} -> ${i.valor} (${i.descricao})`));
    }
}
run();
