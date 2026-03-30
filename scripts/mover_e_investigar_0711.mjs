import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("🚚 Iniciando Movimentação e Investigação do Lote 07/11/2025");

    // 1. Procurar o ID da Conta de Passivo (Antecipações)
    const { data: contasPassivo } = await supabase.from('contas_financeiras')
        .select('id, nome').ilike('tipo', '%Passivo%').limit(1);
    
    if (!contasPassivo || contasPassivo.length === 0) {
        console.error("Conta Passivo não encontrada!");
        return;
    }
    const idPassivo = contasPassivo[0].id;

    // 2. Mover os boletos identificados na Conta Corrente
    const idsParaMover = [7779, 7746, 8227];
    const { data: moved, error: errMove } = await supabase.from('lancamentos')
        .update({ conta_id: idPassivo })
        .in('id', idsParaMover)
        .select('id, descricao, data_vencimento, valor');

    if (errMove) {
        console.error("Erro ao mover:", errMove);
    } else {
        console.log(`✅ ${moved.length} boletos transferidos com sucesso para a conta ${contasPassivo[0].nome}!`);
        for (const m of moved) console.log(`   -> Movido [ID ${m.id}]: R$ ${m.valor} (${m.data_vencimento})`);
    }

    // 3. Investigar o Ap 502
    console.log(`\n🔍 Investigando histórico do AP 502 (buscando o que aconteceu com as parcelas de 4.495,12)...`);
    
    // A parcela 1 era a ID 8162. Vamos puxar ela pra pegar o 'venda_id' ou a descricao exata
    const { data: p1 } = await supabase.from('lancamentos').select('*').eq('id', 8162).single();
    if(p1) {
        console.log(`Bússola encontrada (ID 8162). Não há Venda ID registrado, buscando todas as parcelas "AP 502"...`);

        const { data: irmaos } = await supabase.from('lancamentos')
            .select('id, valor, data_vencimento, descricao, status')
            .ilike('descricao', '%AP 502%')
            .order('data_vencimento', { ascending: true });

        if(irmaos && irmaos.length > 0) {
            let md = "🔎 Investigação 'AP 502' entre Out/2025 e Fev/2026\n\n";
            for(const item of irmaos.filter(i => 
                i.data_vencimento && (
                i.data_vencimento.startsWith('2025-10') ||
                i.data_vencimento.startsWith('2025-11') ||
                i.data_vencimento.startsWith('2025-12') ||
                i.data_vencimento.startsWith('2026-01') ||
                i.data_vencimento.startsWith('2026-02'))
            )){
               md += `- **${item.data_vencimento}** | R$ ${item.valor} | [${item.id}] | ${item.descricao}\n`;
            }
            fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/AP502_INVESTIGACAO.md', md);
            console.log("Relatório AP 502 salvo.");
        } else {
            console.log("Nenhum boleto encontrado com 'AP 502' na descrição.");
        }
    } else {
        console.log("Parcela base ID 8162 não encontrada!");
    }
}

main().catch(console.error);
