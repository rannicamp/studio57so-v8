import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("=== CAÇA-FANTASMAS: O BOLETO DE MARÇO DO PAULO (AP 603) ===");

    // Vamos buscar tudo de Receita que tenha "603" na string principal ou que pertença ao Contato do Paulo
    const { data: boletos_ap603, error: err1 } = await supabase.from('lancamentos')
        .select(`id, descricao, valor, data_vencimento, data_pagamento, conciliado, conta_id, contatos(nome)`)
        .eq('tipo', 'Receita')
        .ilike('descricao', '%603%')
        .order('data_vencimento', { ascending: true });

    if (err1) {
        console.error("Erro na busca AP 603:", err1);
        return;
    }

    // Filtrar apenas ano 2026
    const filter2026 = boletos_ap603.filter(b => b.data_vencimento && b.data_vencimento.startsWith('2026'));

    let output = "=== TODOS OS BOOLEANOS DO AP 603 EM 2026 ===\n";
    
    for (let b of filter2026) {
        output += `[ID ${b.id.toString().padStart(5)}] Venc: ${b.data_vencimento} | Pagou: ${b.data_pagamento || 'NÃO PAGO '} | Conta: ${b.conta_id} | R$ ${b.valor.toString().padStart(8)} | Desc: ${b.descricao}\n`;
    }

    fs.writeFileSync('log_paulo_mar.txt', output);
    console.log("Salvo em log_paulo_mar.txt!");
}

main().catch(console.error);
