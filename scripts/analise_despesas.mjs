import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outFile = 'C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/relatorio_despesas_antecipacao.md';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Buscar todos os lançamentos de DESPESA que fazem parte de uma antecipação
    const { data: lancamentos, error } = await supabase
        .from('lancamentos')
        .select(`
            id, descricao, valor, tipo, status, data_transacao, conta_id,
            contas_financeiras ( nome, tipo ),
            categoria_id, categorias_financeiras ( nome ),
            antecipacao_grupo_id
        `)
        .eq('tipo', 'Despesa')
        .not('antecipacao_grupo_id', 'is', null)
        .order('data_transacao', { ascending: false });

    if (error) {
        fs.writeFileSync(outFile, "Erro na base ao buscar despesas.");
        return;
    }

    // Filtrar apenas despesas cujas contas envolvam "ANTECIPA" no nome ou sejam "Passivo"
    const despesasAlvo = lancamentos.filter(l => {
        const nomeConta = (l.contas_financeiras?.nome || '').toUpperCase();
        const tipoConta = (l.contas_financeiras?.tipo || '').toUpperCase();
        return nomeConta.includes('ANTECIPA') || tipoConta === 'CONTA DE PASSIVO';
    });

    let md = `# 📊 Relatório de Despesas de Antecipação\n\n`;
    md += `> [!NOTE]\n> Lista filtrada contendo **exclusivamente as despesas** (saídas) atreladas aos grupos de antecipação que foram descontadas de contas do tipo "Passivo" ou de "Antecipações".\n\n`;

    md += `Abaixo estão listadas **${despesasAlvo.length}** despesas encontradas no sistema, organizadas pela data mais recente:\n\n`;

    // Tabela bonita e bem estrturada
    md += `| Data | Grupo da Antecipação | Valor (R$) | Conta (Passivo) | Status | Descrição do Sistema |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    despesasAlvo.forEach(l => {
        const dataFormatada = l.data_transacao ? new Date(l.data_transacao).toLocaleDateString('pt-BR') : 'N/A';
        const val = Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const contaNome = l.contas_financeiras?.nome || 'Sem Conta';
        const idCurto = l.id.toString().slice(0, 8);
        const grupoCurto = l.antecipacao_grupo_id.toString().slice(0, 8);
        const statusIco = l.status === 'Conciliado' || l.status === 'Pago' ? '✅' : '⏳';
        
        md += `| ${dataFormatada} | \`${grupoCurto}\` | **${val}** | 🏦 ${contaNome} | ${statusIco} ${l.status} | <small>*(ID: ${idCurto})* ${l.descricao?.replace(/\n/g, ' ')}</small> |\n`;
    });

    md += `\n---\n\n`;
    md += `> [!TIP]\n> Para rastrear um boleto específico, copie o código no campo **Grupo da Antecipação** e procure no banco de dados para ver quais receitas entraram em contrapartida a esta despesa.\n`;

    fs.writeFileSync(outFile, md);
    fs.writeFileSync('C:/Projetos/studio57so-v8/RELATORIO_DESPESAS_ANTECIPACOES.md', md);
    console.log("✔️ Arquivo MD gerado com sucesso em " + outFile);
}

main();
