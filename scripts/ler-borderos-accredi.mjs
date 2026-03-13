// scripts/ler-borderos-accredi.mjs
// Extrai PDFs de antecipação da AC CREDI
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: '.env.local', override: true });

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error('❌ GEMINI_API_KEY não encontrada!'); process.exit(1); }

const MODELO = "gemini-2.5-flash";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(__dirname, '..', 'EMPRÉSTIMOS', 'AC CREDI - ANTECIPAÇÃO RECEBÍVEIS');
const SAIDA = path.resolve(PASTA, '_ANÁLISES');

if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });

const PROMPT = `Você é especialista em extração de borderôs bancários de antecipação de recebíveis.
Analise este borderô e extraia TODOS os dados disponíveis no formato:

=== BORDERÔ AC CREDI - ANTECIPAÇÃO DE RECEBÍVEIS ===
DATA DA OPERAÇÃO: [data]
NÚMERO DA OPERAÇÃO: [número]
INSTITUIÇÃO: [banco/cooperativa]
EMPRESA CEDENTE: [nome]
VALOR BRUTO TOTAL: [valor]
VALOR DAS TAXAS/JUROS: [valor e composição (Juros + IOF + TAC se houver)]
VALOR LÍQUIDO: [valor]
TAXA DE DESCONTO: [%]
PRAZO MÉDIO: [dias]

=== RECEBÍVEIS ANTECIPADOS ===
| # | Devedor | Nº Título/Boleto | Contrato | Parcela | Vencimento | Valor |
[liste cada recebível]

=== RESUMO ===
Quantidade de recebíveis: [qtd]
Valor total dos títulos: [valor]
Valor líquido creditado: [valor]
Conta de crédito: [conta se houver]

=== OBSERVAÇÕES ===
[dados relevantes não encaixados acima]

IMPORTANTE: Se não encontrar um campo, escreva "Não informado". Não invente dados.`;

async function uploadPDF(caminho, nome) {
    const bytes = fs.readFileSync(caminho);
    const init = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${API_KEY}`,
        { method: 'POST', headers: {
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'start',
            'X-Goog-Upload-Header-Content-Length': bytes.length,
            'X-Goog-Upload-Header-Content-Type': 'application/pdf',
            'Content-Type': 'application/json',
        }, body: JSON.stringify({ file: { display_name: nome } }) }
    );
    if (!init.ok) {
        const err = await init.text();
        throw new Error(`Upload init falhou (${init.status}): ${err.slice(0, 200)}`);
    }
    const uploadUrl = init.headers.get('x-goog-upload-url');
    if (!uploadUrl) throw new Error('Sem URL de upload');

    const up = await fetch(uploadUrl, { method: 'POST', headers: {
        'Content-Length': bytes.length,
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
    }, body: bytes });
    const data = await up.json();
    if (!data.file?.uri) throw new Error(`Upload falhou: ${JSON.stringify(data)}`);
    return data.file;
}

async function gerarTexto(uri, mime) {
    const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [
              { file_data: { mime_type: mime || 'application/pdf', file_uri: uri } },
              { text: PROMPT }
          ]}]}) }
    );
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || JSON.stringify(d));
    return d.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta';
}

async function deletar(name) {
    try { await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${API_KEY}`, { method: 'DELETE' }); } catch {}
}

async function main() {
    const pdfs = fs.readdirSync(PASTA).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
    console.log(`\n🔎 AC CREDI — ${pdfs.length} PDFs encontrados:\n`);
    pdfs.forEach((f,i) => console.log(`  ${i+1}. ${f}`));

    for (const nome of pdfs) {
        const caminho = path.join(PASTA, nome);
        const saida = path.join(SAIDA, nome.replace(/\.pdf$/i, '.txt'));
        if (fs.existsSync(saida)) { console.log(`\n⏭️  Já extraído: ${nome}`); continue; }

        console.log(`\n📄 Processando: ${nome}`);
        const arq = await uploadPDF(caminho, nome);
        console.log(`   ✅ Upload OK`);
        await new Promise(r => setTimeout(r, 3000));
        const texto = await gerarTexto(arq.uri, arq.mimeType);
        await deletar(arq.name);
        const conteudo = `ARQUIVO: ${nome}\nEXTRAÍDO: ${new Date().toLocaleString('pt-BR')}\n${'='.repeat(60)}\n\n${texto}`;
        fs.writeFileSync(saida, conteudo, 'utf8');
        console.log(`   💾 TXT salvo.`);
        await new Promise(r => setTimeout(r, 5000));
    }
    console.log('\n✅ Extração AC CREDI concluída!');
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
