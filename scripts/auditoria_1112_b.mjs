import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    let output = "=== BUSCA MATHEUS E ALSENIR ===\n";

    // Busca Alsenir (Valor 4205.83)
    const { data: dAlsenir } = await supabase.from('lancamentos')
        .select('id, data_vencimento, valor, descricao, contatos(nome)')
        .gte('valor', 4200)
        .lte('valor', 4210)
        .eq('tipo', 'Receita')
        .order('data_vencimento');

    output += "\n--- ALSENIR (Alvo: 2026-03-05 | 4205.83) ---\n";
    dAlsenir.forEach(d => output += `ID:${d.id} | Venc:${d.data_vencimento} | R$${d.valor} | Nome:${d.contatos?.nome || 'n/a'}\n`);

    // Busca Matheus (Valor 4276.91)
    const { data: dMatheus } = await supabase.from('lancamentos')
        .select('id, data_vencimento, valor, descricao, contatos(nome)')
        .gte('valor', 4270)
        .lte('valor', 4300)
        .ilike('descricao', '%Matheus%')
        .eq('tipo', 'Receita')
        .order('data_vencimento');

    output += "\n--- MATHEUS (Alvo: 2026-04-10 | 4276.91) ---\n";
    dMatheus.forEach(d => output += `ID:${d.id} | Venc:${d.data_vencimento} | R$${d.valor} | Desc:${d.descricao}\n`);

    // Busca Matheus genérico sem filtro de string
    const { data: dMatheusAll } = await supabase.from('lancamentos')
        .select('id, data_vencimento, valor, contatos(nome)')
        .gte('valor', 4275)
        .lte('valor', 4280)
        .eq('tipo', 'Receita')
        .order('data_vencimento');
    
    output += "\n--- BOLETOS ENTRE 4275 e 4280 ---\n";
    dMatheusAll.forEach(d => output += `ID:${d.id} | Venc:${d.data_vencimento} | R$${d.valor} | Nome:${d.contatos?.nome || 'n/a'}\n`);

    fs.writeFileSync('log_1112.txt', output);
}
main();
