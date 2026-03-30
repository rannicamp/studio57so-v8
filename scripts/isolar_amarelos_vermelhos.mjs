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
    console.log("🔍 Isolando Lotes com Pendências (Amarelo e Vermelho)");
    const dir = 'C:/Projetos/studio57so-v8/EMPRÉSTIMOS/CREDIRIODOCE - ANTECIPAÇÃO RECEBÍVEIS/TXT_EXTRAIDOS/';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && !f.startsWith('_'));

    const borderos = [];

    // Lendo os Borderôs (ignorando relatórios globais e a duplicata Studio57.txt)
    for (const filename of files) {
        if (filename.toUpperCase().includes('RELATÓRIO')) continue;
        if (filename.toUpperCase().includes('STUDIO 57.TXT')) continue;
        
        const content = fs.readFileSync(path.join(dir, filename), 'utf-8');
        const lines = content.split('\n');
        
        const bordero = {
            filename,
            dataOperacao: null,
            valorBruto: 0,
            boletos: []
        };

        let inTable = false;

        for (const line of lines) {
            if (line.includes('DATA DA OPERAÇÃO:')) {
                const parts = line.split('DATA DA OPERAÇÃO:');
                if(parts[1]) bordero.dataOperacao = parseBrazilianDate(parts[1].trim());
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

    const { data: contasPassivo } = await supabase.from('contas_financeiras').select('id, nome').ilike('tipo', '%Passivo%');
    const contaIds = contasPassivo ? contasPassivo.map(c => c.id) : [];

    const { data: receitas } = await supabase.from('lancamentos').select('id, valor, descricao, data_vencimento').in('conta_id', contaIds).eq('tipo', 'Receita');
    const { data: despesas } = await supabase.from('lancamentos').select('id, valor, transferencia_id').in('conta_id', contaIds).eq('tipo', 'Despesa');

    const universoBoletos = [...(receitas || [])];

    let md = `# ⚠️ Triagem de Pendências: Lotes Amarelos e Vermelhos\n\n`;
    md += `Abaixo estão isolados todos os lotes que possuem boletos com disparidade de data de vencimento (🟡 Amarelo) ou boletos totalmente faltantes no Passivo (🔴 Vermelho).\n\n`;

    let totalLotesAvaliados = 0;
    let lotesComProblema = 0;
    let totalBoletosVermelhos = 0;
    let totalBoletosAmarelos = 0;

    for (const bordero of borderos) {
        totalLotesAvaliados++;
        const somaValorFace = bordero.boletos.reduce((acc, b) => acc + b.valor, 0);

        let isPerfeito = true;
        let boletosLote = [];
        
        let tempClone = [...universoBoletos];

        for (const item of bordero.boletos) {
            let res = { ...item, status: '🔴 NÃO ACHOU NO BD!', cor: '🔴', idBanco: '-', detalhe: '-' };
            
            // Tenta match Verde exato
            let idxVerde = tempClone.findIndex(r => Math.abs(Number(r.valor)) === item.valor && r.data_vencimento === item.vencimento);
            
            if (idxVerde !== -1) {
                res.status = '🟢 OK';
                res.cor = '🟢';
                res.idBanco = String(tempClone[idxVerde].id);
                res.detalhe = tempClone[idxVerde].descricao;
                tempClone.splice(idxVerde, 1);
            } else {
                // Tenta match Amarelo (valor igual mas data não bate)
                let idxAmarelo = tempClone.findIndex(r => Math.abs(Number(r.valor)) === item.valor);
                if (idxAmarelo !== -1) {
                    res.status = `🟡 AVISO | VencBD: ${formatBR(tempClone[idxAmarelo].data_vencimento)}`;
                    res.cor = '🟡';
                    res.idBanco = String(tempClone[idxAmarelo].id);
                    res.detalhe = tempClone[idxAmarelo].descricao;
                    tempClone.splice(idxAmarelo, 1);
                    isPerfeito = false;
                    totalBoletosAmarelos++;
                } else {
                    isPerfeito = false;
                    totalBoletosVermelhos++;
                }
            }
            boletosLote.push(res);
        }

        // Se for 100% perfeito, esse lote já foi processado na etapa anterior, pula ele.
        if (isPerfeito) {
            // Consome da lista global para não conflitar com os amarelos dos outros lotes (já que eles ocupariam o lugar erradamente)
            for(const b of boletosLote) {
                let i = universoBoletos.findIndex(r => r.id === Number(b.idBanco));
                if(i !== -1) universoBoletos.splice(i, 1);
            }
            continue;
        }

        lotesComProblema++;

        // Consume os encontrados do pool global para simular o mundo real
        for(const b of boletosLote) {
            if (b.cor !== '🔴') {
               let i = universoBoletos.findIndex(r => r.id === Number(b.idBanco));
               if(i !== -1) universoBoletos.splice(i, 1);
            }
        }

        // Verifica a Despesa/Transferência Associada para referencial
        const despesaMatches = (despesas || []).filter(d => 
            Math.abs(Number(d.valor)) === bordero.valorBruto ||
            Math.abs(Number(d.valor)) === somaValorFace
        );

        let transStatus = "🔴 Transferência Não Encontrada";
        if (despesaMatches.length === 1) {
            transStatus = `**OK** | ID: \`${despesaMatches[0].id}\` (\`${despesaMatches[0].transferencia_id || 'sem-link'}\`) | R$ ${despesaMatches[0].valor}`;
        }

        md += `## 📦 Pendências: Lote de ${formatBR(bordero.dataOperacao)} \n`;
        md += `*Saída Esperada: R$ ${bordero.valorBruto || somaValorFace}* | Status da Transferência no BD: ${transStatus}\n\n`;
        md += `### 🚧 Boletos que Necessitam Revisão Manual\n\n`;
        md += `| Venc. (Borderô) | Valor (R$) | Status | ID Banco | Descrição |\n`;
        md += `| --- | --- | --- | --- | --- |\n`;

        for (const b of boletosLote) {
            if (b.cor !== '🟢') { // Mostrar apenas pendências!
                md += `| ${formatBR(b.vencimento)} | R$ ${b.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | ${b.status} | \`${b.idBanco}\` | ${b.detalhe.substring(0, 25)}... |\n`;
            }
        }
        md += `\n---\n`;
    }

    md += `\n**Resumo:** Encontramos **${lotesComProblema} lotes** problemáticos, contendo **${totalBoletosAmarelos}** conflitos de data (🟡) e **${totalBoletosVermelhos}** boletos perdidos (🔴).\n`;
    
    fs.writeFileSync('C:/Users/ranni/.gemini/antigravity/brain/39938ccc-f495-4960-88da-52a37cb7b449/boletos_pendentes_artefato.md', md);
    console.log(`Relatório de Pendências salvo com sucesso!`);
}

main().catch(console.error);
