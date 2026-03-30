import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("🛠️ Preparando Divisão de Boletos das Irmãs Monte Alto...");

    // 1. Procurar as irmãs
    const { data: cAngela } = await supabase.from('contatos').select('id, nome').ilike('nome', '%Angela%Monte%Alto%');
    const { data: cAlessandra } = await supabase.from('contatos').select('id, nome').ilike('nome', '%Alessandra%Monte%Alto%');

    if (!cAngela || cAngela.length === 0) throw new Error("Angela não encontrada!");
    if (!cAlessandra || cAlessandra.length === 0) throw new Error("Alessandra não encontrada!");

    const angelaId = cAngela[0].id;
    const alessandraId = cAlessandra[0].id;

    console.log(`✅ Angela: ID ${angelaId} - ${cAngela[0].nome}`);
    console.log(`✅ Alessandra: ID ${alessandraId} - ${cAlessandra[0].nome}`);

    // 2. Buscar lançamentos da Angela com valor 3850 (ou todos os que precisam ser divididos)
    // O usuário disse "dividir todos os boletos da angela por dois". Como é do contrato do "AP 602 | Residencial Alfa",
    // vamos buscar todos os de receita dela vinculados a esse contrato ou o valor "3850".
    const { data: lancamentos, error } = await supabase.from('lancamentos')
        .select('*')
        .eq('favorecido_contato_id', angelaId)
        .gte('valor', 3840)
        .lte('valor', 3860)
        .order('data_vencimento', { ascending: true });

    if (error) {
        throw new Error("Erro da API: " + JSON.stringify(error));
    }

    console.log(`\n🔍 Encontrados ${lancamentos?.length || 0} boletos de Angela do AP 602 para dividir.`);

    let md = `# 🔪 Simulação de Divisão dos Boletos 602\n\n`;
    md += `Vamos transformar ${lancamentos.length} boletos únicos de **${cAngela[0].nome}** em ${lancamentos.length * 2} boletos separados (50% para Angela, 50% para Alessandra).\n\n`;

    let opsUpdate = [];
    let opsInsert = [];

    for (let l of lancamentos) {
        const novoValor = Number((l.valor / 2).toFixed(2));
        
        md += `#### Boleto Original: \`${l.id}\` | Venc: ${l.data_vencimento} | R$ ${l.valor} | UUID Lote: ${l.antecipacao_grupo_id || 'Nenhum'}\n`;
        md += `- **Update Angela:** R$ ${novoValor}\n`;
        md += `- **Insert Alessandra:** O mesmo Lançamento para ID ${alessandraId} | R$ ${novoValor}\n\n`;

        // Clonar para Novo
        const clonado = { ...l };
        delete clonado.id;
        delete clonado.created_at; // Para deixar o BD criar
        clonado.valor = novoValor;
        clonado.favorecido_contato_id = alessandraId;
        
        opsUpdate.push({ id: l.id, valor: novoValor });
        opsInsert.push(clonado);
    }

    fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/SIMULACAO_DIVISAO.md', md);
    fs.writeFileSync('./scripts/ops_divisao.json', JSON.stringify({ opsUpdate, opsInsert }, null, 2));

    console.log(`\nSalvamos a simulação no arquivo SIMULACAO_DIVISAO.md.`);
}

main().catch(console.error);
