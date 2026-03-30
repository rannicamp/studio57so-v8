import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function parseBrazilianDate(dateStr) {
    const regex = /(\d{2})\/(\d{2})\/(\d{4})/;
    const match = dateStr.match(regex);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return null;
}

async function main() {
    console.log("🛠️ Aplicando Patch de 1 Centavo nos Boletos 6719 e 6720...");

    const { data: contasPassivo } = await supabase.from('contas_financeiras')
        .select('id, nome').ilike('tipo', '%Passivo%').limit(1);
    const passivo_id = contasPassivo[0].id;

    // PATCH OS BOLETOS DO AP 502
    await supabase.from('lancamentos').update({ valor: 4495.12, conta_id: passivo_id }).in('id', [6719, 6720]);
    console.log("✅ Boletos 6719 e 6720 ajustados para R$ 4.495,12 e movidos para o Passivo.");

    console.log("\n🧪 Testando validação completa da Trinca para o arquivo 07/11/2025...");

    const arquivo = 'C:/Projetos/studio57so-v8/EMPRÉSTIMOS/CREDIRIODOCE - ANTECIPAÇÃO RECEBÍVEIS/TXT_EXTRAIDOS/Antecipação 25-11-07 - Borderô - DOCUMENTO ASSINATURA ELETRÔNICA 4394202448115214564.txt';
    const raw = fs.readFileSync(arquivo, 'utf8');

    // 1. Extrair Data de Liberação (Data da Operação/Emissão) e Valor Bruto Total
    let dataLiberacaoStr = null;
    let esperadoValorBruto = 0;
    
    // As vezes a data vem como "DATA DA OPERAÇÃO: 22/10/2025"
    let liberacaoMatch = raw.match(/DATA DA OPERAÇÃO:\s*(\d{2}\/\d{2}\/\d{4})/i) || raw.match(/Emissão[^\d]+(\d{2}\/\d{2}\/\d{4})/i);
    if (liberacaoMatch) dataLiberacaoStr = parseBrazilianDate(liberacaoMatch[1]);
    
    let brutoMatch = raw.match(/VALOR BRUTO TOTAL:\s*R\$\s*([\d\.,]+)/i) || raw.match(/Valor Bruto:\s*([\d\.,]+)/i);
    if(brutoMatch) esperadoValorBruto = parseFloat(brutoMatch[1].replace(/\./g, '').replace(',', '.'));

    // 2. Extrair os Boletos (Títulos)
    const boletosBordero = [];
    const lines = raw.split('\n');
    let readingBoletos = false;
    
    for (const l of lines) {
        if (l.includes('CPF/CNPJ')) { readingBoletos = true; continue; }
        if (readingBoletos && (l.includes('TOTAL') || l.includes('DADOS DA TRANSFER'))) { readingBoletos = false; break; }
        
        if (readingBoletos) {
            const matches = l.match(/(\d{2}\/\d{2}\/\d{4})[^\d]+([\d\.,]+)$/);
            if (matches) {
                const bVenc = parseBrazilianDate(matches[1]);
                const bVal = parseFloat(matches[2].replace(/\./g, '').replace(',', '.'));
                boletosBordero.push({ v: bVal, d: bVenc });
            }
        }
    }

    console.log(`Lote Data: ${dataLiberacaoStr} | Valor Bruto Total Alvo: R$ ${esperadoValorBruto}`);
    console.log(`Boletos no Borderô: ${boletosBordero.length}`);

    // Pegar o Passivo
    const { data: bda } = await supabase.from('lancamentos').select('*').eq('conta_id', passivo_id).eq('tipo', 'Receita');
    
    // Tentar casar os boletos
    let erroDate = 0;
    let erroNotFound = 0;
    
    const dbCopy = [...(bda || [])];

    for(const t of boletosBordero) {
        let matched = false;
        // Search Exato
        let hitIdx = dbCopy.findIndex(x => Math.abs(Number(x.valor)) === t.v && x.data_vencimento === t.d);
        if(hitIdx > -1) {
            matched = true;
            dbCopy.splice(hitIdx, 1);
            continue;
        }

        // Search Data Errada
        hitIdx = dbCopy.findIndex(x => Math.abs(Number(x.valor)) === t.v);
        if(hitIdx > -1) {
            erroDate++;
            dbCopy.splice(hitIdx, 1);
            continue;
        }

        erroNotFound++;
    }

    if (erroDate === 0 && erroNotFound === 0) {
        console.log(`🟢 RESULTADO: PERFEITO! 100% Casado. O Lote está VERDE!`);
    } else {
        console.log(`🔴 RESULTADO: Falharam ${erroDate} por Data e ${erroNotFound} por Ausência.`);
    }

}

main().catch(console.error);
