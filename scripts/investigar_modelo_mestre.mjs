import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data: mestre } = await supabase.from('lancamentos').select('*').eq('id', 12294).single();
    if(mestre) {
        console.log(`\n=== MOLDE DO MESTRE (LOTE 29/01) ===`);
        console.log(`ID: ${mestre.id} | Tipo: ${mestre.tipo}`);
        console.log(`Valor Original: R$ ${mestre.valor} | Valor Pago: R$ ${mestre.valor_pago}`);
        console.log(`Conta: ${mestre.conta_id} | Categoria: ${mestre.categoria_id}`);
        console.log(`Grupo: ${mestre.antecipacao_grupo_id}`);
        console.log(`Transferencia ID: ${mestre.transferencia_id}`);
    }

    const { data: b } = await supabase.from('lancamentos').select('*').eq('id', 7748).single();
    if(b) {
        console.log(`\n=== MOLDE DO BOLETO (LOTE 29/01) ===`);
        console.log(`ID: ${b.id} | Tipo: ${b.tipo}`);
        console.log(`Valor Original: R$ ${b.valor} | Valor Pago: R$ ${b.valor_pago}`);
        console.log(`Conta: ${b.conta_id} | Categoria: ${b.categoria_id}`);
        console.log(`Grupo: ${b.antecipacao_grupo_id}`);
    }
}
main().catch(console.error);
