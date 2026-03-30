import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("🚀 Executando a divisão de Boletos...");

    const ops = JSON.parse(fs.readFileSync('./scripts/ops_divisao.json', 'utf8'));

    console.log(`Buscando ${ops.opsUpdate.length} updates e ${ops.opsInsert.length} inserts.`);

    for (let u of ops.opsUpdate) {
        const { id, ...updateData } = u;
        const { error } = await supabase.from('lancamentos').update(updateData).eq('id', id);
        if (error) {
            console.error(`❌ Erro no UPDATE do ID ${id}:`, error);
        } else {
            console.log(`✅ UPDATE ID ${id} para R$ ${updateData.valor}`);
        }
    }

    if (ops.opsInsert.length > 0) {
        const { error } = await supabase.from('lancamentos').insert(ops.opsInsert);
        if (error) {
            console.error(`❌ Erro no INSERT em massa:`, error);
        } else {
            console.log(`✅ INSERSÃO DE ${ops.opsInsert.length} BOLETOS DA ALESSANDRA CONCLUIDA!`);
        }
    }

    console.log(`\n🎉 Operação de Divisão Finalizada!`);
}

main().catch(console.error);
