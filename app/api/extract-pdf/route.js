import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req) {
  try {
    if (!genAI) {
      return NextResponse.json({ error: "Chave GEMINI_API_KEY não configurada no servidor." }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    // CORREÇÃO PRINCIPAL: Atualizado para o modelo 2.0 Flash
    // Se o 2.0 ainda não estiver disponível na sua região, tente 'gemini-1.5-flash-002'
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Data atual para ajudar a IA no contexto de virada de ano
    const hoje = new Date();
    const dataContexto = `${hoje.getFullYear()}-${hoje.getMonth() + 1}-${hoje.getDate()}`;

    const prompt = `
      Você é um assistente especializado em contabilidade e processamento de dados financeiros para o sistema "Studio 57". 
      Sua única função é receber arquivos PDF (faturas de cartão, extratos bancários) e converter os dados brutos em CSV.

      DATA DE HOJE PARA CONTEXTO: ${dataContexto}

      ### 📋 SUAS REGRAS DE OURO:

      1. Analise o PDF: Identifique padrões de linhas que contenham DATA, DESCRIÇÃO e VALOR.
      2. Ignore Lixo: Descarte linhas de cabeçalho, rodapé, "Saldo Anterior", "Total da Fatura", "Pagamento Efetuado", "Juros de Financiamento" ou saldos parciais. Queremos apenas as COMPRAS e ESTORNOS novos.
      3. Tratamento de Data:
         * Se a data no PDF for apenas "DD/MM" (ex: 12/11), você DEVE inferir o ano. 
         * Olhe para a "Data de Vencimento" ou "Data de Fechamento" da fatura no topo do PDF para descobrir o ano correto da fatura. Use esse ano para as transações.
         * Formato final OBRIGATÓRIO: AAAA-MM-DD.
      4. Tratamento de Valor:
         * Mantenha o valor numérico puro com ponto para decimal (ex: 1250.50). Não use 'R$' ou separador de milhar.
         * Importante: Se for uma COMPRA/DESPESA, o valor deve ser NEGATIVO (ex: -100.00).
         * Se for um CRÉDITO/ESTORNO/PAGAMENTO RECEBIDO, o valor deve ser POSITIVO (ex: 100.00).
      5. Formatação de Saída (CSV):
         * Use ponto e vírgula (;) como separador.
         * Cabeçalho OBRIGATÓRIO na primeira linha: Data;Descricao;Valor;CategoriaSugestiva
         * Não use blocos de código markdown (sem \`\`\`csv), retorne apenas o texto puro.

      ### 🤖 AÇÃO:
      Processe o documento fornecido e gere o CSV agora.
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
    console.error("ERRO GEMINI:", error);
    
    // Tratamento de erro amigável
    let msg = error.message || "Erro desconhecido";
    if (msg.includes("404") || msg.includes("not found")) {
        msg = "Modelo de IA não encontrado. Verifique se sua conta tem acesso ao 'gemini-2.0-flash'.";
    }
    
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}