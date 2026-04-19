const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("Iniciando Criação da Dívida e Clonagem...");

    // 1. Criar a conta de passivo ou resgatá-la se já existir
    let novaContaId = null;
    const nomeConta = 'P - EMPRÉSTIMOS BANCÁRIOS';
    
    // Verificar se já existe (pra evitar duplicações se rodar o script 2x)
    const { data: existe, error: errExist } = await supabase.from('contas_financeiras').select('id').eq('nome', nomeConta).maybeSingle();
    
    if (existe) {
        novaContaId = existe.id;
        console.log(`Conta passiva já existe: [ID ${novaContaId}]`);
    } else {
        const { data: nConta, error: errCria } = await supabase.from('contas_financeiras').insert({
            nome: nomeConta,
            tipo: 'Conta de Passivo',
            organizacao_id: 1
        }).select('id').single();
        
        if (errCria) { console.error("Erro ao criar conta:", errCria); return; }
        novaContaId = nConta.id;
        console.log(`Nova carteira de PASSIVO criada com sucesso: [ID ${novaContaId}]`);
    }

    // 2. Busca os 3 originais de Empréstimos bancários (Cat 300) do tipo Receita
    const { data: originais, error: errFetch } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('categoria_id', 300) 
        .eq('tipo', 'Receita');
        
    if (errFetch) {
        console.error("Erro na busca:", errFetch);
        return;
    }

    console.log(`Lotes originais de empréstimo encontrados: ${originais.length}`);
    let clones = [];
    
    for (const org of originais) {
        // Criar espelho garantindo a herança do empresa_id integralmente
        let clone = { ...org };
        delete clone.id; // Remover ID para criação do zero
        delete clone.created_at; 
        delete clone.updated_at;
        
        // Modificações de passivo rigorosas
        clone.conta_id = novaContaId; // A nova conta P - EMPRÉSTIMOS BANCÁRIOS
        clone.tipo = 'Despesa'; 
        clone.valor = -Math.abs(clone.valor); // Sangria
        
        clones.push(clone);
    }
    
    console.log("Montante global alocado como Passivo:", clones.reduce((acc, v) => acc + v.valor, 0));
    
    // 3. Inserção em Lote (Bulk Insert)
    const { data: inserted, error: errIns } = await supabase
        .from('lancamentos')
        .insert(clones)
        .select('id, valor, descricao, empresa_id');
        
    if (errIns) {
        console.error("Erro no Insert Batch das Despesas:", errIns);
    } else {
        console.log(`\nSUCESSO CIRÚRGICO! ${inserted.length} transações criadas no Passivo!`);
        inserted.forEach(i => console.log(`Injetado: ID ${i.id} -> ${i.valor} ${i.empresa_id ? 'CNPJ Anexado' : ''} (${i.descricao})`));
    }
}
run();
