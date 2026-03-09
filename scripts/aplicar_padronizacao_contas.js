const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Faltando variáveis de ambiente!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function atualizarNomesContas() {
    const { data: contas, error } = await supabase
        .from('contas_financeiras')
        .select('*');

    if (error) {
        console.error("Erro ao buscar contas:", error);
        return;
    }

    console.log(`=== INICIANDO PADRONIZAÇÃO DE CONTAS ===\n`);

    let atualizadas = 0;

    for (const conta of contas) {
        let novoNome = conta.nome;
        let codBanco = conta.codigo_banco_ofx;
        let inst = conta.instituicao;

        // Inferência manual segura dos maiores bancos usados caso o cód esteja vazio
        if (!codBanco && inst) {
            const instLower = inst.toLowerCase();
            if (instLower.includes('sicoob') || instLower.includes('credi')) codBanco = '756';
            else if (instLower.includes('inter')) codBanco = '077';
            else if (instLower.includes('caixa')) codBanco = '104';
            else if (instLower.includes('brasil')) codBanco = '001';
            else if (instLower.includes('bradesco')) codBanco = '237';
            else if (instLower.includes('itau') || instLower.includes('itaú')) codBanco = '341';
        }

        if (codBanco && inst) {
            const codFormatado = String(codBanco).padStart(3, '0');
            novoNome = `${codFormatado} - ${inst}`;
        }

        if (novoNome !== conta.nome) {
            console.log(`🔄 Atualizando ID ${conta.id}: "${conta.nome}" -> "${novoNome}"`);

            // Define codigo_banco_ofx corretamente caso tenhamos inferido ele
            const { error: updateError } = await supabase
                .from('contas_financeiras')
                .update({
                    nome: novoNome,
                    codigo_banco_ofx: codBanco ? String(codBanco).padStart(3, '0') : null
                })
                .eq('id', conta.id);

            if (updateError) {
                console.error(`❌ Erro ao atualizar conta ${conta.id}:`, updateError);
            } else {
                atualizadas++;
                console.log(`✅ Sucesso!`);
            }
        } else {
            console.log(`➖ ID ${conta.id} mantido: "${conta.nome}"`);
        }
    }

    console.log(`\n🎉 Concluído! ${atualizadas} contas foram padronizadas com sucesso no banco de dados.`);
}

atualizarNomesContas();
