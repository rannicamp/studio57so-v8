import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outFile = 'C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/boletos_banco_antecipados.md';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Buscar contas de antecipação (Onde moram os boletos que agora são do banco)
    const { data: contas } = await supabase
        .from('contas_financeiras')
        .select('id, nome')
        .ilike('nome', '%ANTECIPA%');

    if (!contas || contas.length === 0) {
        console.error("Nenhuma conta de antecipação encontrada!");
        return;
    }

    const contaIds = contas.map(c => c.id);

    // Buscar todos os lançamentos que estão DENTRO destas contas de antecipação e que são Receitas (Os boletos originais)
    const { data: boletosBanco, error } = await supabase
        .from('lancamentos')
        .select(`
            id, descricao, valor, tipo, status, data_vencimento, data_transacao,
            antecipacao_grupo_id, conta_id, contas_financeiras ( nome ),
            categoria_id, categorias_financeiras ( nome )
        `)
        .in('conta_id', contaIds)
        .eq('tipo', 'Receita') // Buscamos os recebíveis
        .order('data_vencimento', { ascending: false });

    if (error) {
        console.error("Erro ao buscar boletos no banco de dados:", error);
        return;
    }

    let md = `# 🏦 Boletos Pertencentes ao Banco (Antecipados)\n\n`;
    md += `> [!NOTE]\n> Lista de todos os **Recebíveis (Boletos)** que foram movidos para as contas de **Antecipação** (Ou seja, boletos que agora pertencem ao Banco Sicoob/etc).\n\n`;

    const agrupados = boletosBanco.filter(b => b.antecipacao_grupo_id);
    const orfaos = boletosBanco.filter(b => !b.antecipacao_grupo_id);

    md += `Foram encontrados **${boletosBanco.length}** boletos no total morando nestas contas.\n`;
    md += `- **${agrupados.length}** já possuem um Grupo de Antecipação (Estão amarrados à operação de crédito).\n`;
    md += `- **${orfaos.length}** estão "Órfãos" (Foram movidos para a conta do banco, mas não possuem um ID de Grupo atrelando-os à operação).\n\n`;

    md += `## ⚠️ Boletos Órfãos (Precisam ser Agrupados/Corrigidos)\n\n`;

    if (orfaos.length > 0) {
        md += `| Vencimento | Valor Boleto | Status | Conta | Descrição do Boleto |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- |\n`;
        orfaos.forEach(b => {
             const dataFormatada = b.data_vencimento ? new Date(b.data_vencimento).toLocaleDateString('pt-BR') : 'Sem Data';
             const val = Number(b.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
             md += `| ${dataFormatada} | **${val}** | ${b.status} | ${b.contas_financeiras?.nome} | <small>*(ID: ${b.id.toString().slice(0,8)})* ${b.descricao?.replace(/\n/g, ' ')}</small> |\n`;
        });
    } else {
        md += `*Nenhum boleto órfão encontrado. Todos os boletos nestas contas já possuem um grupo de antecipação (antecipacao_grupo_id).* \n\n`;
    }

    md += `\n---\n\n## 🔗 Boletos Já Agrupados no Sistema\n\n`;

    if (agrupados.length > 0) {
        md += `| Vencimento | Valor Boleto | Grupo atrelado | Status | Descrição do Boleto |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- |\n`;
        agrupados.forEach(b => {
             const dataFormatada = b.data_vencimento ? new Date(b.data_vencimento).toLocaleDateString('pt-BR') : 'Sem Data';
             const val = Number(b.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
             const grupoCurto = b.antecipacao_grupo_id.toString().slice(0, 8);
             md += `| ${dataFormatada} | **${val}** | \`${grupoCurto}\` | ${b.status} | <small>*(ID: ${b.id.toString().slice(0,8)})* ${b.descricao?.replace(/\n/g, ' ')}</small> |\n`;
        });
    }

    fs.writeFileSync(outFile, md);
    console.log("✔️ Lista gerada no artefato: " + outFile);
}

main();
