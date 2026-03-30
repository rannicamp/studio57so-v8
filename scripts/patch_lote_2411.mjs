import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("🩹 Aplicando Patch e Fechando o Lote 24/11...");

    const antecipacao_grupo_id = '533b1dfe-f9ed-4d1e-a612-2a5a1f5a4565';
    const idsToUpdate = [8791, 6756, 16713, 7909, 8048, 10699];

    // 1. Corrigir data do Paulo e Conta/Agrupamento de todos
    const { error } = await supabase.from('lancamentos')
        .update({ 
            conta_id: 33, 
            antecipacao_grupo_id 
        })
        .in('id', idsToUpdate);

    if (error) throw error;
    console.log(`✅ ${idsToUpdate.length} Boletos agrupados e movidos para a Conta 33!`);

    // 2. Corrigir Data do Paulo (ID 7909)
    const { error: errorPaulo } = await supabase.from('lancamentos')
        .update({ data_vencimento: '2026-01-10' })
        .eq('id', 7909);

    if (errorPaulo) throw errorPaulo;
    console.log(`✅ Boleto 7909 (Paulo) ajustado para '2026-01-10'!`);

    console.log("🎉 Lote 24/11 100% Finalizado!");
}

main().catch(console.error);
