const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Faltando variáveis de ambiente (SUPABASE_SERVICE_ROLE_KEY).");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function previewNomes() {
    const { data: contas, error } = await supabase
        .from('contas_financeiras')
        .select('*');

    if (error) {
        console.error("Erro ao buscar contas:", error);
        return;
    }

    console.log(`=== PREVISÃO DE PADRONIZAÇÃO DE CONTAS ===`);
    console.log(`Encontradas ${contas.length} contas.\n`);

    for (const conta of contas) {
        let novoNome = conta.nome;
        let novoCod = !!conta.codigo_banco_ofx;

        // Se a conta não tiver código mas pudermos inferir pela instituição (comum no S57)
        let codBanco = conta.codigo_banco_ofx;
        let inst = conta.instituicao;

        if (!codBanco && inst) {
            const instLower = inst.toLowerCase();
            if (instLower.includes('sicoob') || instLower.includes('credi')) codBanco = '756';
            else if (instLower.includes('inter')) codBanco = '077';
            else if (instLower.includes('caixa')) codBanco = '104';
            else if (instLower.includes('brasil')) codBanco = '001';
            else if (instLower.includes('bradesco')) codBanco = '237';
            else if (instLower.includes('itaú') || instLower.includes('itau')) codBanco = '341';
        }

        // Só padroniza se for conta em banco (tem instituição/código)
        if (codBanco && inst) {
            const codFormatado = String(codBanco).padStart(3, '0');
            novoNome = `${codFormatado} - ${inst}`;
        }

        if (novoNome !== conta.nome) {
            console.log(`✅ [${conta.id}] De: "${conta.nome}"\n       Para: "${novoNome}" (Cod: ${codBanco})`);
        } else {
            console.log(`➖ [${conta.id}] Mantida: "${conta.nome}"`);
        }
    }
}

previewNomes();
