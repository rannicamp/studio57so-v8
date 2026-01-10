import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req) {
  try {
    if (!genAI) {
      return NextResponse.json({ error: "Chave de API não configurada." }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    // Converte para Base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    // Usa o modelo flash-latest para garantir compatibilidade
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const prompt = `
      Você é um assistente financeiro. Analise este extrato ou fatura (PDF) e extraia TODAS as transações financeiras em formato CSV.
      
      Regras Estritas:
      1. Retorne APENAS o CSV cru. Sem markdown, sem aspas, sem explicações.
      2. Cabeçalho (não inclua no output, apenas siga a ordem): Data,Descricao,Valor
      3. Formato Data: YYYY-MM-DD
      4. Formato Valor: 1234.50 (ponto para decimal). Use sinal negativo (-) para despesas/saídas e positivo para receitas/entradas.
      5. Descricao: Nome do estabelecimento ou histórico curto.
      
      Exemplo de saída desejada:
      2024-01-15,Supermercado ABC,-150.20
      2024-01-16,Pagamento Cliente X,5000.00
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type || "application/pdf",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Limpeza para garantir que venha apenas o CSV
    const csvClean = text.replace(/```csv/g, "").replace(/```/g, "").trim();

    return NextResponse.json({ csv: csvClean });

  } catch (error) {
    console.error("Erro IA:", error);
    return NextResponse.json({ error: error.message || "Erro ao processar PDF" }, { status: 500 });
  }
}