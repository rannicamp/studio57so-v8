import { NextResponse } from "next/server";
import { generateContentWithTelemetry } from "@/utils/gemini";

export async function POST(req) {
  try {
    const { extrato, sistema } = await req.json();

    if (!extrato?.length || !sistema?.length) {
      return NextResponse.json({ matches: [] });
    }

    // Otimização: Limpa os dados para reduzir tokens e focar no essencial
    const extratoSimples = extrato.map(e => ({ id: e.id, data: e.data, valor: e.valor, desc: e.descricao }));
    const sistemaSimples = sistema.map(s => ({ id: s.id, data: s.data, valor: s.valor, desc: s.descricao }));

    const prompt = `
    Você é um auditor contábil especialista em Conciliação Bancária.
    Sua missão é encontrar pares correspondentes entre o EXTRATO (banco) e o SISTEMA (interno).

    ### 🧠 REGRAS DE RACIOCÍNIO AVANÇADO:

    1. **A Regra de Ouro do Valor:**
    - O VALOR é o fator mais forte. Se os valores forem idênticos (ex: 51.91 e 51.91) ou muito próximos (diferença de centavos), é um forte candidato.
    - Se o valor for exato, você pode ser mais flexível com a data e descrição.

    2. **O Dilema das Datas (IMPORTANTE):**
    - Em cartões de crédito, a data do extrato é a da COMPRA, mas no sistema pode estar a data do VENCIMENTO da fatura.
    - **IGNORE diferenças de data de até 45 dias** se o VALOR for exato e a DESCRIÇÃO tiver palavras-chave iguais.
    - Exemplo: Compra "Uber" dia 01/10 (Extrato) pode bater com "Uber" dia 20/11 (Sistema). Isso é um MATCH VÁLIDO.

    3. **Semântica da Descrição:**
    - "IOF DIAR ROT" (Extrato) == "IOF ROTATIVO PJ" (Sistema).
    - "PGTO DEBITO" (Extrato) == "PAGAMENTO CARTÃO" (Sistema).
    - "MERCADOLIVRE" (Extrato) == "PAGAMENTO MERCADO LIVRE" (Sistema).

    ### 📥 DADOS PARA ANALISAR:

    EXTRATO (Bancário/PDF):
    ${JSON.stringify(extratoSimples)}

    SISTEMA (Interno):
    ${JSON.stringify(sistemaSimples)}

    ### 📤 SAÍDA ESPERADA:
    Retorne APENAS um JSON Array com os pares encontrados. Se não achar nada, retorne [].
    Formato: [{"extratoId": "...", "sistemaId": "...", "motivo": "Valor exato e descrição similar"}]
    `;

    const result = await generateContentWithTelemetry({
      modelName: "gemini-2.5-flash",
      promptContent: prompt,
      generationConfig: { responseMimeType: "application/json" },
      origem: "/api/conciliacao/match-ia",
      context: "Match de Conciliação Bancária"
    });

    const responseText = result.response.text();
    const matches = JSON.parse(responseText);

    return NextResponse.json({ matches });

  } catch (error) {
    console.error("Erro Match IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}