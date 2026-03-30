import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

function parseBrazilianFloat(str) {
    if(!str) return 0;
    const cleanStr = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanStr);
}

function parseBrazilianDate(str) {
    if(!str) return null;
    const match = str.match(/\d{2}\/\d{2}\/\d{4}/);
    if(!match) return null;
    const parts = match[0].split('/');
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
}

function formatBR(dateStr) {
    if(!dateStr) return 'Data Desconhecida';
    const p = dateStr.split('-');
    if(p.length !== 3) return dateStr;
    return `${p[2]}/${p[1]}/${p[0]}`;
}

async function main() {
    const dir = 'C:/Projetos/studio57so-v8/EMPRÉSTIMOS/CREDIRIODOCE - ANTECIPAÇÃO RECEBÍVEIS/TXT_EXTRAIDOS/';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && !f.startsWith('_'));

    const borderos = [];

    // Parse files
    for (const filename of files) {
        const content = fs.readFileSync(path.join(dir, filename), 'utf-8');
        const lines = content.split('\n');
        
        const bordero = {
            filename,
            dataOperacao: null,
            valorLiquido: 0,
            valorBruto: 0,
            boletos: []
        };

        let inTable = false;

        for (const line of lines) {
            if (line.includes('DATA DA OPERAÇÃO:')) {
                const parts = line.split('DATA DA OPERAÇÃO:');
                if(parts[1]) bordero.dataOperacao = parseBrazilianDate(parts[1].trim());
            }
            if (line.includes('VALOR LÍQUIDO:')) {
                const parts = line.split('VALOR LÍQUIDO:');
                if(parts[1]) bordero.valorLiquido = parseBrazilianFloat(parts[1].trim());
            }
            if (line.includes('VALOR BRUTO TOTAL:')) {
                const parts = line.split('VALOR BRUTO TOTAL:');
                if(parts[1]) bordero.valorBruto = parseBrazilianFloat(parts[1].trim());
            }

            if (line.includes('|---|')) {
                inTable = true;
                continue;
            }

            if (inTable && line.startsWith('|') && !line.includes('===') && !line.includes('RESUMO')) {
                const cols = line.split('|').map(c => c.trim()).filter(c => c);
                if (cols.length >= 5 && cols[0].match(/^\d+$/)) { // col 0 is index
                    // col 1 = Devedor
                    // col 2 = Doc
                    // col 3 = Vencimento
                    // col 4 = Valor Face
                    bordero.boletos.push({
                        devedor: cols[1],
                        documento: cols[2],
                        vencimento: parseBrazilianDate(cols[3]),
                        valor: parseBrazilianFloat(cols[4])
                    });
                }
            } else if (inTable && line.includes('=== RESUMO ===')) {
                inTable = false;
            }
        }
        borderos.push(bordero);
    }

    borderos.sort((a, b) => {
        const da = a.dataOperacao ? new Date(a.dataOperacao).getTime() : 0;
        const db = b.dataOperacao ? new Date(b.dataOperacao).getTime() : 0;
        return da - db;
    });

    console.log(`🔍 Bordereaux extraídos: ${borderos.length}`);

    // Pegar BD
    const { data: contasPassivo } = await supabase.from('contas_financeiras')
        .select('id, nome').ilike('tipo', '%Passivo%');
    const contaIds = contasPassivo ? contasPassivo.map(c => c.id) : [];

    const { data: receitas } = await supabase.from('lancamentos')
        .select('id, valor, descricao, data_vencimento, data_pagamento, created_at')
        .in('conta_id', contaIds).eq('tipo', 'Receita')
        .order('data_vencimento', { ascending: false });

    const { data: despesas } = await supabase.from('lancamentos')
        .select('id, valor, descricao, data_vencimento, data_pagamento, created_at')
        .in('conta_id', contaIds).eq('tipo', 'Despesa')
        .order('data_pagamento', { ascending: false });

    const safeReceitas = receitas || [];
    const safeDespesas = despesas || [];

    // Lotes do banco
    // Lotes do banco (removido o filtro burro que apaga quando Lote = Boleto Unico)
    const despesasLote = [...safeDespesas];
    
    // Universo total de boletos passivos não linkados (aqui simulamos todos da query)
    const universoBoletos = [...safeReceitas];

    let md = `# ✅ Revisão dos Lotes de Antecipação\n\n`;
    md += `O sistema cruzou os dados dos TXTs (**Borderôs Oficiais**) com o que estava perdido (órfão) no **Supabase** combinando **(VALOR + DATA VENCIMENTO)**.\n\n`;

    let totalEncontrados = 0;
    let totalFaltantes = 0;

    for (const bordero of borderos) {
        // Ignora arquivos que são relatórios globais e não borderôs específicos
        if (bordero.filename.toUpperCase().includes('RELATÓRIO')) continue;

        md += `## 📦 Transferência / Lote de ${formatBR(bordero.dataOperacao)}\n`;
        md += `*Arquivo: ${bordero.filename}*\n\n`;
        
        // Calcula o Valor Face (Bruto)
        const somaValorFace = bordero.boletos.reduce((acc, b) => acc + b.valor, 0);

        // Match a Despesa (Apenas Valor Bruto, o líquido causa confusão no balanço final do Sicoob)
        const despesaMatches = despesasLote.filter(d => 
            Math.abs(Number(d.valor)) === bordero.valorBruto ||
            Math.abs(Number(d.valor)) === somaValorFace
        );

        if (despesaMatches.length === 1) {
            md += `**💸 Transferência Achada no Banco:** ID \`${despesaMatches[0].id}\` | Saída: **R$ ${Math.abs(Number(despesaMatches[0].valor))}**\n\n`;
        } else if (despesaMatches.length > 1) {
            md += `⚠️ **Múltiplas Transferências com mesmo valor!** (IDs: ${despesaMatches.map(d=>d.id).join(', ')})\n\n`;
        } else {
            md += `🔴 **Nenhuma transferência encontrada para o Valor Bruto (R$ ${bordero.valorBruto || somaValorFace})!**\n\n`;
        }

        md += `### 📄 Boletos Internos do Lote (${bordero.boletos.length} títulos)\n`;
        md += `| Venc. (Borderô) | Valor (R$) | Status Match | ID Banco | Detalhe Banco |\n`;
        md += `| --- | --- | --- | --- | --- |\n`;

        for (const item of bordero.boletos) {
            const vStr = item.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2});
            
            // Match 1: Estrito (Valor + Data Exata)
            let idxBoleto = universoBoletos.findIndex(r => 
                Math.abs(Number(r.valor)) === item.valor &&
                r.data_vencimento === item.vencimento
            );

            // Match 2: Flexível (Apenas Valor) para ignorar diferenças de feriado no vencimento
            let isExactDate = true;
            if (idxBoleto === -1) {
                idxBoleto = universoBoletos.findIndex(r => Math.abs(Number(r.valor)) === item.valor);
                isExactDate = false;
            }

            if (idxBoleto !== -1) {
                const boletoBanco = universoBoletos[idxBoleto];
                universoBoletos.splice(idxBoleto, 1); // Consume o boleto
                totalEncontrados++;
                
                const statusStr = isExactDate ? `🟢 OK (Data e Valor)` : `🟡 OK (Valor Ok | Banco Venc: ${formatBR(boletoBanco.data_vencimento)})`;
                md += `| ${formatBR(item.vencimento)} | R$ ${vStr} | ${statusStr} | \`${boletoBanco.id.toString().substring(0,6)}\` | ${boletoBanco.descricao.substring(0,25)}... |\n`;
            } else {
                totalFaltantes++;
                md += `| ${formatBR(item.vencimento)} | R$ ${vStr} | 🔴 NÃO ACHOU NO BD! | - | - |\n`;
            }
        }
        md += `\n---\n`;
    }

    md += `\n## Resumo Geral de Encaixe\n`;
    md += `- **Boletos Mapeados Corretamente:** ${totalEncontrados}\n`;
    md += `- **Boletos Perdidos/Faltantes:** ${totalFaltantes}\n`;

    fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/REVISAO_LOTES.md', md);
    console.log(`Relatório salvo com ${totalEncontrados} sucessos e ${totalFaltantes} faltantes.`);
}

main().catch(console.error);
