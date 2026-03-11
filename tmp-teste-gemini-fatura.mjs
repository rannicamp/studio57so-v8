import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function testGemini() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const filePath = path.join(process.cwd(), 'faturas', '24_10_FAT_ BANCO DO BRASIL_CARTÃO ELO PRIMEIRA INCORPORAÇÃO 2.pdf');
    
    if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        return;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');

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
    "data_vencimento_fatura": "2026-02-10", // OBRIGATÓRIO: Formato YYYY-MM-DD indicando a data final de vencimento PRINCIPAL da fatura lida.
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

    console.log("Sending to Gemini...");
    try {
        const result = await model.generateContent([prompt, pdfPart]);
        const responseText = await result.response.text();
        console.log("--- RAW RESPONSE ---");
        console.log(responseText);
        
        let cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const extratos = JSON.parse(cleanJson);
        console.log("--- PARSED JSON ---");
        console.log(JSON.stringify(extratos, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

testGemini();
