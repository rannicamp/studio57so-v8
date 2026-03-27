import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
    console.log("Corrigindo Fatura Caixa...");
    // Update real file to conta Caixa (33)
    let res = await supabaseAdmin.from('banco_arquivos_ofx').update({ conta_id: 33 }).eq('id', 'e84e98e0-51c0-4174-892e-975b62132c49');
    console.log("Arquivo atualizado:", res.error || "OK");

    // Update the transaction falling
    res = await supabaseAdmin.from('banco_transacoes_ofx').update({ conta_id: 33 }).eq('arquivo_id', 'e84e98e0-51c0-4174-892e-975b62132c49');
    console.log("Transações movidas para 33:", res.error || "OK");

    // Delete the phantom "2027" file
    res = await supabaseAdmin.from('banco_arquivos_ofx').delete().eq('id', '5b22ff26-2f9d-4bd4-bb07-dcb43587cc44');
    console.log("Arquivo fantasma de 2027 removido:", res.error || "OK");
}
fix();
