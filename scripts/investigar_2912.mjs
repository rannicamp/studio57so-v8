import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("=== AUDITORIA CIRÚRGICA: LOTE 29/12/2025 ===");

    const targets = [
        { nome: 'MATHEUS (4276.91 | 10/03/2026)', min: 4275, max: 4278, dataBol: '2026-03-10' },
        { nome: 'CAROLINA (1833.93 | 15/03/2026)', min: 1832, max: 1835, dataBol: '2026-03-15' },
        { nome: 'PAULO (3498.60 | 10/03/2026)', min: 3496, max: 3500, dataBol: '2026-03-10' },
        { nome: 'DARLENE (4170.83 | 10/03/2026)', min: 4169, max: 4172, dataBol: '2026-03-10' },
        { nome: 'MONTE ALTO (7706.37 | 15/03/2026)', min: 7705, max: 7708, dataBol: '2026-03-15' },
        { nome: 'JOSÉ ROGERIO 1 (4289.13 | 19/03/2026)', min: 4287, max: 4291, dataBol: '2026-03-19' },
        { nome: 'JOSÉ ROGERIO 2 (4246.67 | 19/03/2026)', min: 4245, max: 4248, dataBol: '2026-03-19' }
    ];

    let output = "=== DUMP LOTE 29/12 ===\n";

    for (let bol of targets) {
        output += `\n--- Alvo: ${bol.nome} ---\n`;
        const { data, error } = await supabase.from('lancamentos')
            .select(`id, data_vencimento, valor, descricao, contatos (nome)`)
            .gte('valor', bol.min)
            .lte('valor', bol.max)
            .eq('tipo', 'Receita')
            .order('data_vencimento', { ascending: true });

        if (error) {
            output += `Erro: ${error.message}\n`;
        } else {
            // Filtrar meses próximos para pegar deslizes de data
            const matchData = data.filter(d => d.data_vencimento && d.data_vencimento.startsWith('2026-03'));
            if(matchData.length === 0) {
                output += `❌ NENHUM BOLETO PERTO DE MAR/2026!\n`;
            } else {
                matchData.forEach(d => {
                    const diffDays = Math.abs(new Date(d.data_vencimento) - new Date(bol.dataBol)) / (1000 * 60 * 60 * 24);
                    const tag = diffDays === 0 ? "🎯 CRAVADO " : "🟡 DERRAPADO";
                    output += `${tag} -> ID: ${d.id} | Venc: ${d.data_vencimento} | R$ ${d.valor} | Fav: ${d.contatos?.nome || 'n/a'}\n`;
                });
            }

            // Exceção de caça fantasma
            if (matchData.length === 0) {
               const furtherMatches = data.filter(d => d.data_vencimento && d.data_vencimento.startsWith('2026'));
               output += `   ⚠️ Buscando no ano todo de 2026: Encontrados ${furtherMatches.length} boletos com esse valor (provável deslocamento crônico de mês)\n`;
               furtherMatches.forEach(d => {
                    output += `   -> ID: ${d.id} | Venc: ${d.data_vencimento} | R$ ${d.valor}\n`;
               });
            }
        }
    }

    fs.writeFileSync('dump_2912.txt', output);
    console.log("Arquivo gerado: dump_2912.txt");
}

main().catch(console.error);
