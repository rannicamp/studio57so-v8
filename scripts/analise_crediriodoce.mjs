import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outFile = 'C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/analise_antecipacoes_crediriodoce.md';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    let md = `# Análise de Antecipações: Contas Credi/Sicoob\n\n`;
    
    // Lista contas que tem "credi" no nome, Trazendo o TIPO da conta
    const { data: contas } = await supabase
        .from('contas_financeiras')
        .select('id, nome, tipo')
        .ilike('nome', '%credi%');

    const contaIds = contas.map(c => c.id);
    
    md += `## Contas Monitoradas\n`;
    contas.forEach(c => md += `- **[${c.id}]** ${c.nome} *(Tipo: ${c.tipo})*\n`);

    const { data: lancamentos, error } = await supabase
        .from('lancamentos')
        .select(`
            id, descricao, valor, tipo, status, conta_id,
            contas_financeiras ( nome, tipo ),
            categoria_id, categorias_financeiras ( nome ),
            antecipacao_grupo_id
        `)
        .not('antecipacao_grupo_id', 'is', null)
        .order('antecipacao_grupo_id', { ascending: true })
        .order('tipo', { ascending: true }); 

    if (error) {
        fs.writeFileSync(outFile, "Erro na base");
        return;
    }

    const gruposEnvolvidos = new Set();
    lancamentos.forEach(l => {
        if (contaIds.includes(l.conta_id)) gruposEnvolvidos.add(l.antecipacao_grupo_id);
    });

    md += `\n## Lançamentos Encontrados\nEncontramos **${gruposEnvolvidos.size}** operações de parcelas de antecipação relacionadas a estas contas.\n\n`;
    md += `*Obs: Note na coluna "Conta" qual é o **Tipo da Conta** bancária/passivo vinculada.*\n\n`;

    const lancamentosFiltrados = lancamentos.filter(l => gruposEnvolvidos.has(l.antecipacao_grupo_id));
    const grupos = {};
    lancamentosFiltrados.forEach(l => {
        if (!grupos[l.antecipacao_grupo_id]) grupos[l.antecipacao_grupo_id] = [];
        grupos[l.antecipacao_grupo_id].push(l);
    });

    for (const grupoId in grupos) {
        md += `### 🔗 Operação ID: \`${grupoId}\`\n\n`;
        md += `| Tipo (DRE) | Conta Origem | Tipo da Conta | Vlr (R$) | St |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- |\n`;
        
        let descricoes = [];
        grupos[grupoId].forEach(l => {
            const isCredi = contaIds.includes(l.conta_id);
            const val = Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            const contaNome = l.contas_financeiras?.nome || 'N/A';
            const contaTipo = l.contas_financeiras?.tipo || 'N/A';
            const isPassivo = (contaTipo === 'Conta de Passivo');
            
            const tipoContaBadge = isPassivo ? `🚩 **PASSIVO**` : `🏦 ${contaTipo}`;

            const tipoFmt = l.tipo === 'Receita' ? '🟢 Receita' : '🔴 Despesa';
            const destaque = isCredi ? '**' : '';

            md += `| ${tipoFmt} | ${destaque}${contaNome}${destaque} | ${tipoContaBadge} | ${val} | ${l.status} |\n`;
            
            descricoes.push(`> <small>**ID ${String(l.id).slice(0, 8)}**: ${l.descricao?.replace(/\n/g, ' ')}</small>`);
        });
        
        md += `\n**Descrições Originais:**\n${descricoes.join('\n')}\n`;
        md += `\n---\n\n`;
    }

    fs.writeFileSync(outFile, md);
    console.log("✔️ Arquivo MD gerado com sucesso em " + outFile);
}

main();
