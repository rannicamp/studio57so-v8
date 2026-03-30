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
    console.log("🚀 Iniciando Motor de Triagem Verde (Trinca Total)");
    const dir = 'C:/Projetos/studio57so-v8/EMPRÉSTIMOS/CREDIRIODOCE - ANTECIPAÇÃO RECEBÍVEIS/TXT_EXTRAIDOS/';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && !f.startsWith('_'));

    const borderos = [];

    // Parse files
    for (const filename of files) {
        if (filename.toUpperCase().includes('RELATÓRIO')) continue;
        if (filename.toUpperCase().includes('STUDIO 57.TXT')) continue; // Ignorando a duplicata
        
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
                if (cols.length >= 5 && cols[0].match(/^\d+$/)) { 
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

    // Pegar BD das contas passivas
    const { data: contasPassivo } = await supabase.from('contas_financeiras')
        .select('id, nome').ilike('tipo', '%Passivo%');
    const contaIds = contasPassivo ? contasPassivo.map(c => c.id) : [];

    // Busca geral para todos os boletos
    const { data: receitas } = await supabase.from('lancamentos')
        .select('id, valor, descricao, data_vencimento, data_pagamento, transferencia_id, created_at')
        .in('conta_id', contaIds).eq('tipo', 'Receita');
        
    // Busca a Despesa (Saída do Lote na Conta Passivo)
    const { data: despesas } = await supabase.from('lancamentos')
        .select('id, valor, descricao, data_vencimento, data_pagamento, conta_id, transferencia_id, created_at')
        .in('conta_id', contaIds).eq('tipo', 'Despesa');

    const safeReceitas = receitas || [];
    const despesasLote = despesas || [];
    const universoBoletos = [...safeReceitas];

    let md = `# ✅ Triagem de Lotes 100% Verdes\n\n`;
    md += `Este relatório isola **apenas os lotes perfeitos** (onde todos os boletos bateram verde por data e valor exatos).\n`;
    md += `O sistema aproveitou o \`transferencia_id\` para localizar a **Peça 3** (Entrada da Conta Corrente) que precisará ter sua categoria migrada para Antecipação Sicoob.\n\n`;

    let qtdLotesAptos = 0;

    for (const bordero of borderos) {
        const somaValorFace = bordero.boletos.reduce((acc, b) => acc + b.valor, 0);

        // Pre-Avaliação dos Boletos (Sem queimar o array global para testar primeiro)
        let isPerfeito = true;
        let boletosMapeados = [];
        
        let tempClone = [...universoBoletos];

        for (const item of bordero.boletos) {
            let idxBoleto = tempClone.findIndex(r => 
                Math.abs(Number(r.valor)) === item.valor &&
                r.data_vencimento === item.vencimento
            );
            if (idxBoleto !== -1) {
                boletosMapeados.push(tempClone[idxBoleto]);
                tempClone.splice(idxBoleto, 1);
            } else {
                isPerfeito = false;
                break;
            }
        }

        // Se o lote for furado, pula fora (não documenta pra não dar ruído na tela)
        if (!isPerfeito) continue;
        
        // Se isPerfeito, consumimos eles de verdade
        for(const b of boletosMapeados) {
            let i = universoBoletos.findIndex(r => r.id === b.id);
            if(i !== -1) universoBoletos.splice(i, 1);
        }

        qtdLotesAptos++;

        md += `## 📦 Lote Verde Apto: ${formatBR(bordero.dataOperacao)}\n`;
        md += `*Lote Bruto: R$ ${bordero.valorBruto || somaValorFace} | Boletos: ${bordero.boletos.length}*\n\n`;

        // Peça 2: Achar a Despesa de Saída
        const despesaMatches = despesasLote.filter(d => 
            Math.abs(Number(d.valor)) === bordero.valorBruto ||
            Math.abs(Number(d.valor)) === somaValorFace
        );

        if (despesaMatches.length === 1) {
            const despesa = despesaMatches[0];
            md += `### 🧩 A Trinca Completa:\n`;
            md += `- **[PEÇA 1]** O Lote possui **${boletosMapeados.length}** boletos corretamente amarrados no Passivo.\n`;
            md += `- **[PEÇA 2]** Despesa Saída: ID **#${despesa.id}** no Passivo. Valor: **R$ ${despesa.valor}** (\`${despesa.transferencia_id}\`)\n`;
            
            // Buscar a PEÇA 3 através do transferencia_id
            if (despesa.transferencia_id) {
                const { data: espelhos } = await supabase.from('lancamentos')
                    .select('id, valor, descricao, conta_id')
                    .eq('transferencia_id', despesa.transferencia_id)
                    .neq('id', despesa.id); // Pegar a outra ponta!
                    
                if (espelhos && espelhos.length > 0) {
                    const peca3 = espelhos[0];
                    md += `- **[PEÇA 3]** Entrada Conta Corrente: ID **#${peca3.id}** na ContaID **${peca3.conta_id}**. Valor: **R$ ${peca3.valor}**\n\n`;
                    md += `> **DIAGNÓSTICO TRANQUILO:** Categoria de IDs \`${despesa.id}\` e \`${peca3.id}\` serão trocadas. Boletos preservam categoria.\n\n`;
                } else {
                    md += `- **[PEÇA 3]** ⚠️ ERRO: Transferência ${despesa.transferencia_id} existe mas a ponta 2 não foi encontrada no BD!\n\n`;
                }
            } else {
                md += `- **[PEÇA 3]** ⚠️ ERRO: Despesa ID ${despesa.id} não possui Transferencia_ID!\n\n`;
            }

        } else if (despesaMatches.length > 1) {
            md += `⚠️ **Múltiplas Transferências Ocorrendo no Banco!** (IDs: ${despesaMatches.map(d=>d.id).join(', ')})\n\n`;
        } else {
            md += `🔴 **Despesa não achada no valor de (R$ ${bordero.valorBruto || somaValorFace})!**\n\n`;
        }
        md += `\n---\n`;
    }

    md += `\n**Total de Lotes 100% Verdes Prontos para Gravar:** ${qtdLotesAptos}\n`;
    
    fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/auditoria_trinca_verdes.md', md);
    console.log(`Relatório salvo com sucesso para ${qtdLotesAptos} lotes aptos.`);
}

main().catch(console.error);
