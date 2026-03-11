import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Tenta usar gemini-1.5-flash por ter um limit maior na conta free, mas garantindo eficácia no parse
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
        const base64Data = buffer.toString('base64');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const pdfPart = {
            inlineData: {
                data: base64Data,
                mimeType: "application/pdf"
            },
        };

        const prompt = `Você é um excelente assistente financeiro de uma Construtora. 
Sua tarefa é ler este PDF contendo uma fatura de cartão de crédito.
Algumas faturas possuem DIVERSOS cartões agrupados (ex: Titular e Adicionais).

Retorne EXCLUSIVAMENTE um Array JSON válido com os blocos de cartões encontrados.
MUITO IMPORTANTE: Remova os acentos das chaves e devolva estritamente em JSON puro sem blocos markdown.

A estrutura DEVE SER EXATAMENTE ESTA:
[
  {
    "cartao_final": "0753", // OBRIGATÓRIO: Apenas os 4 últimos dígitos do cartão onde as compras ocorreram. Se for omisso/impossível achar, retorne "".
    "titular": "Igor M A Rezende", // Nome do titular / responsável do cartão impresso no PDF para esse bloco.
    "bandeira": "Elo", // Elo, Visa, Mastercard.
    "lancamentos": [
      {
        "data_transacao": "2026-02-12", // OBRIGATÓRIO no formato YYYY-MM-DD. Assuma o ano com base na fatura, caso haja compras do mês anterior preencha o ano/mês corretamente da transação.
        "descricao": "NOME DO ESTABELECIMENTO", // Descreva o nome da compra.
        "valor": 25.50, // OBRIGATÓRIO Float Numérico. Não use vírgulas para decimais. Exemplo: 1500.50 (SEM SINAL DE MOEDA).
        "tipo": "Despesa" // "Despesa" se for compra normal. "Receita" se for Estorno, Cancelamento, Pagamento recebido ou Crédito. OS VALORES NUMÉRICOS ACIMA SEMPRE DEVEM VIR POSITIVOS, ESSE CAMPO QUE DEFINE!
      }
    ]
  }
]

REGRAS RÍGIDAS DE EXTRAÇÃO:
1. Elimine todas as vírgulas do campo valor (1.500,50 vira 1500.50) e forneça todos os valores positivos independente de sinal impresso (o tipo deve separar o joio do trigo).
2. IGNORE juros, compras parceladas listadas para o futuro de forma descritiva, faturas passadas e limites de crédito. Extraia apenas a MOVIMENTAÇÃO REAL DESCRITA MÊS A MÊS.
3. Se a fatura tiver lançamentos que claramente pertencem a cartões diferentes com finais diferentes, quebre em MÚLTIPLOS OBJETOS DENTRO DO SEU ARRAY PRINCIPAL.
`;

        const result = await model.generateContent([prompt, pdfPart]);
        const responseText = await result.response.text();

        let cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

        // Faz o parse do Array
        const extratos = JSON.parse(cleanJson);

        return NextResponse.json({ success: true, extratos: extratos });

    } catch (error) {
        console.error("Erro no processamento da Fatura pelo Gemini:", error);
        return NextResponse.json(
            { error: "Erro ao processar Fatura com a Inteligência Artificial.", details: error.message },
            { status: 500 }
        );
    }
}
