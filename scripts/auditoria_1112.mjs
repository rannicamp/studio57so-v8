import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("=== AUDITORIA CIRÚRGICA: LOTE 11/12/2025 ===");

    const targets = [
        { nome: 'SAMUEL (8017.19 | 10/03/2026)', min: 8016, max: 8018, dataBol: '2026-03-10' },
        { nome: 'MATHEUS (4276.91 | 10/04/2026)', min: 4275, max: 4278, dataBol: '2026-04-10' },
        { nome: 'ALESSANDRA (14380.00 | 10/03/2026)', min: 14379, max: 14381, dataBol: '2026-03-10' },
        { nome: 'ALSENIR (4205.83 | 05/03/2026)', min: 4204, max: 4207, dataBol: '2026-03-05' }
    ];

    const allResults = {};

    for (let bol of targets) {
        console.log(`\n🔍 Alvo: ${bol.nome}`);
        const { data, error } = await supabase.from('lancamentos')
            .select(`id, data_vencimento, valor, descricao, contatos (nome)`)
            .gte('valor', bol.min)
            .lte('valor', bol.max)
            .eq('tipo', 'Receita')
            .order('data_vencimento', { ascending: true });

        if (error) {
            console.error("Erro", error);
        } else {
            const matchData = data.filter(d => d.data_vencimento && d.data_vencimento.startsWith(bol.dataBol.substring(0, 7)));
            allResults[bol.nome] = matchData.map(d => {
                const diffDays = Math.abs(new Date(d.data_vencimento) - new Date(bol.dataBol)) / (1000 * 60 * 60 * 24);
                return { tag: diffDays === 0 ? "CRAVADO" : "DERRAPADO", diffDays, id: d.id, venc: d.data_vencimento, valor: d.valor, fav: d.contatos?.nome };
            });
        }
    }

    const fs = require('fs');
    fs.writeFileSync('auditoria_11_12_dump.json', JSON.stringify(allResults, null, 2));
    console.log("✅ Dump salvo em auditoria_11_12_dump.json");
}

main().catch(console.error);
