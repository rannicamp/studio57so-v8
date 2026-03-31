import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("=== RAIOS-X: CAÇANDO A DESCIDA DO SICOOB PELA MATEMÁTICA ===");

    // Procurando qualquer Despesa ou Transferencia cujo valor nominal seja próximo a 30.688 ou 27.940 (líquido) na Conta Corrente
    const alvos = [30688.02, 27940.85, 27382.82, 20386.36, 17830.83, 44591.89];

    for(const a of alvos) {
        let queryVal = a;
        
        // Testa tanto positivo quanto negativo
        const { data: d1 } = await supabase.from('lancamentos').select('id, data_vencimento, data_pagamento, valor, descricao, categoria_id, tipo, antecipacao_grupo_id').gte('valor', queryVal - 2).lte('valor', queryVal + 2);
        const { data: d2 } = await supabase.from('lancamentos').select('id, data_vencimento, data_pagamento, valor, descricao, categoria_id, tipo, antecipacao_grupo_id').gte('valor', -(queryVal + 2)).lte('valor', -(queryVal - 2));

        if((d1 && d1.length > 0) || (d2 && d2.length > 0)) {
            console.log(`\n🎯 ENCONTRADO PARA ALVO: ${queryVal}`);
            d1?.forEach(x => console.log(`   [ID ${x.id}] [${x.data_pagamento || x.data_vencimento}] R$ ${x.valor} | ${x.descricao} | Tipo: ${x.tipo} | Cat: ${x.categoria_id} | Grupo: ${x.antecipacao_grupo_id || 'VAZIO'}`));
            d2?.forEach(x => console.log(`   [ID ${x.id}] [${x.data_pagamento || x.data_vencimento}] R$ ${x.valor} | ${x.descricao} | Tipo: ${x.tipo} | Cat: ${x.categoria_id} | Grupo: ${x.antecipacao_grupo_id || 'VAZIO'}`));
        } else {
            console.log(`\n❌ NADA ENCONTRADO PARA ALVO: ${queryVal}`);
        }
    }
}
main().catch(console.error);
