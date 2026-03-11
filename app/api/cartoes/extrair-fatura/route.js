import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pdfParse from 'pdf-parse';

// gemini-2.5-flash para análise de texto (muito mais eficiente que enviar PDF binário)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // ─── NOVO FLUXO: Extração de Texto Puro com pdf-parse ───────────────────
        // Em vez de enviar o PDF binário (base64 pesado) direto para a IA,
        // extraímos primeiro o texto puro localmente. Isso:
        //   1. Reduz o payload ~10x (texto vs base64 do PDF)
        //   2. Reduz consumo de cota da API (text vs file API)
        //   3. Acelera o processamento e evita rate limits
        let textoPdf = '';
        try {
            const parsed = await pdfParse(buffer);
            textoPdf = parsed.text || '';
        } catch (parseErr) {
            console.warn('[pdf-parse] Falha na extração de texto — tentando enviar PDF diretamente:', parseErr.message);
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Você é um assistente especializado em contabilidade e processamento de dados financeiros para o sistema "Studio 57".
Sua única função é analisar o texto extraído de uma fatura de cartão de crédito e converter os dados em JSON estruturado.

🚫 REGRAS RÍGIDAS — O QUE IGNORAR (LIXO):
- IGNORE: Saldo Anterior, Total da Fatura, Pagamento Efetuado, Juros de Financiamento, Encargos, IOF, Limite de Crédito (como linha de transação), Melhor dia de pagamento.
- IGNORE: Parcelas futuras listadas em formato descritivo (ex: "Parcela 02/05 a vencer"). Extraia apenas os lançamentos REAIS DO MÊS ATUAL da fatura.
- IGNORE: Linhas de cabeçalho, rodapé, separadores e resumos.
- EXTRAIA APENAS: Compras, Serviços, Estornos, Créditos e Cancelamentos reais.

📅 TRATAMENTO DE DATA:
- Se a data na fatura for "DD/MM", deduza o ano correto com base no período da fatura.
- Se a transação for de Dezembro (12) e a fatura for de Janeiro (01), use o ANO ANTERIOR para essa transação.
- Formato final obrigatório: YYYY-MM-DD.

💰 TRATAMENTO DE VALOR:
- Remova vírgulas de milhar e converta decimal para ponto (1.500,50 → 1500.50).
- TODOS os valores numéricos devem vir POSITIVOS. O campo "tipo" define se é entrada ou saída.
- "tipo": "Despesa" → compra, serviço, tarifa (valor positivo no JSON).
- "tipo": "Receita" → estorno, crédito, cancelamento, pagamento recebido (valor positivo no JSON).

🃏 CARTÕES MÚLTIPLOS:
- Algumas faturas agrupam VÁRIOS cartões (titular + adicionais). Se houver lançamentos de cartões com finais DIFERENTES, separe em objetos distintos dentro do array.

Retorne EXCLUSIVAMENTE um Array JSON válido, SEM markdown, SEM texto extra, SEM blocos de código. Apenas o JSON puro.

A estrutura DEVE SER EXATAMENTE ESTA:
[
  {
    "cartao_final": "0753",
    "titular": "Igor M A Rezende",
    "bandeira": "Elo",
    "instituicao": "Banco do Brasil",
    "data_vencimento_fatura": "2026-02-10",
    "data_fechamento_fatura": "2026-01-07",
    "limite_credito": 5000.00,
    "lancamentos": [
      {
        "data_transacao": "2026-01-15",
        "descricao": "NOME DO ESTABELECIMENTO",
        "valor": 150.00,
        "tipo": "Despesa"
      }
    ]
  }
]`;

        let result;

        if (textoPdf && textoPdf.trim().length > 100) {
            // ✅ CAMINHO PRINCIPAL: Texto extraído com sucesso → envia só texto (leve e rápido)
            console.log(`[pdf-parse] Texto extraído: ${textoPdf.length} caracteres. Enviando texto para a IA.`);
            result = await model.generateContent([
                prompt,
                `\n\n--- TEXTO EXTRAÍDO DA FATURA ---\n${textoPdf}\n--- FIM DO TEXTO ---`
            ]);
        } else {
            // ⚠️ FALLBACK: PDF escaneado/imagem → envia binário como antes
            console.log('[pdf-parse] Texto insuficiente (PDF escaneado?). Enviando PDF binário como fallback.');
            const base64Data = buffer.toString('base64');
            result = await model.generateContent([
                prompt,
                { inlineData: { data: base64Data, mimeType: 'application/pdf' } }
            ]);
        }

        const responseText = await result.response.text();
        let cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const extratos = JSON.parse(cleanJson);

        return NextResponse.json({ success: true, extratos });

    } catch (error) {
        console.error('Erro no processamento da Fatura pelo Gemini:', error);
        return NextResponse.json(
            { error: 'Erro ao processar Fatura com a Inteligência Artificial.', details: error.message },
            { status: 500 }
        );
    }
}
