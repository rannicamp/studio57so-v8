// app/api/gemini/analyze/route.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from 'next/server';

// Pega a chave da API do ambiente
const apiKey = process.env.GEMINI_API_KEY;

// Verifica se a chave foi encontrada. Se não, para tudo e retorna um erro claro.
if (!apiKey) {
  // Este erro é para o console do servidor, para nós vermos
  console.error("ERRO CRÍTICO: A variável GEMINI_API_KEY não foi encontrada no ambiente.");
}

// Inicializa a IA somente se a chave existir
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(request) {
  // Nova verificação: se a IA não foi inicializada por falta da chave, retorna um erro amigável.
  if (!genAI) {
    return NextResponse.json({ error: "A chave da API de IA não está configurada no servidor." }, { status: 500 });
  }

  try {
    const { lancamentos } = await request.json();

    if (!lancamentos || lancamentos.length === 0) {
      return NextResponse.json({ error: "Nenhum dado financeiro para analisar." }, { status: 400 });
    }

    const dadosParaAnalise = lancamentos.map(l => 
      `- Descrição: ${l.descricao}, Valor: ${l.valor}, Tipo: ${l.tipo}, Data: ${l.data_transacao}, Categoria: ${l.categoria?.nome || 'N/A'}`
    ).join('\n');

    const prompt = `
      Você é um assistente financeiro especialista em análise de dados para uma empresa de construção.
      Analise os seguintes lançamentos financeiros e forneça um resumo claro e objetivo em bullet points (formato de lista).

      Sua análise deve, obrigatoriamente, incluir:
      - Um resumo geral do período (total de receitas, despesas e o saldo).
      - As 3 maiores despesas, em ordem decrescente.
      - A principal fonte de receita.
      - Qualquer observação ou tendência incomum que você identificar (por exemplo, gastos elevados em uma categoria específica, repetição de despesas, etc.).

      Use um tom profissional e direto.

      Aqui estão os dados:
      ${dadosParaAnalise}
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysisText = response.text();

    return NextResponse.json({ analysis: analysisText });

  } catch (error) {
    console.error("Erro na API do Gemini:", error);
    return NextResponse.json({ error: "Ocorreu um erro ao se comunicar com a IA." }, { status: 500 });
  }
}