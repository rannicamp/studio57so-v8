import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("=== INVESTIGAÇÃO PROFUNDA: LOTE 10/12/2025 ===");

    const targets = [
        { nome: 'SAMUEL (8017.19)', min: 8016, max: 8100 },
        { nome: 'ANGELA (14380.00)', min: 14379, max: 14450 },
        { nome: 'KARINA (4495.12)', min: 4495, max: 4600 }
    ];

    const allResults = {};

    for (let bol of targets) {
        console.log(`\n🔍 Buscando por valor aproximado: ${bol.nome}`);
        const { data, error } = await supabase.from('lancamentos')
            .select(`id, data_vencimento, valor, descricao, contatos (nome)`)
            .gte('valor', bol.min)
            .lte('valor', bol.max)
            .eq('tipo', 'Receita');

        if (error) console.error("Erro", error);
        else allResults[bol.nome] = data;
    }

    const fs = require('fs');
    fs.writeFileSync('lote1012_dump.json', JSON.stringify(allResults, null, 2));
    console.log('Dump salvo com sucesso em lote1012_dump.json');
}

main().catch(console.error);
