// app/api/test-lead/route.js

import { NextResponse } from 'next/server';

// Esta API simula o recebimento de um lead da Meta e o envia para o nosso webhook principal.
export async function POST(request) {
  console.log("LOG: [TESTE] Rota de simulação de lead foi acionada.");

  // Estes são os dados de teste que vamos enviar.
  // Note que incluímos o campo "objetivo" e outros campos personalizados.
  const fakeLeadPayload = {
    object: 'page',
    entry: [
      {
        id: '1234567890', // ID da Página do Facebook (fictício)
        time: Math.floor(Date.now() / 1000),
        changes: [
          {
            field: 'leadgen',
            value: {
              ad_id: 'AD123',
              form_id: 'FORM123',
              leadgen_id: `TEST_${Date.now()}`, // ID do Lead único para cada teste
              created_time: Math.floor(Date.now() / 1000),
              page_id: '1234567890',
              adgroup_id: 'ADGROUP123',
            },
          },
        ],
      },
    ],
  };

  try {
    // Aqui, o nosso simulador chama o nosso webhook de verdade,
    // exatamente como a Meta faria.
    const response = await fetch(`${request.nextUrl.origin}/api/meta/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fakeLeadPayload),
    });

    if (!response.ok) {
      throw new Error(`O webhook respondeu com um erro: ${response.statusText}`);
    }

    console.log("LOG: [TESTE] Webhook respondeu com sucesso.");
    return NextResponse.json({
      success: true,
      message: 'Simulação de lead enviada com sucesso para o webhook! Verifique o CRM.',
    });

  } catch (error) {
    console.error("LOG: [TESTE] Erro ao simular o envio do lead:", error);
    return NextResponse.json(
      { success: false, error: `Falha na simulação: ${error.message}` },
      { status: 500 }
    );
  }
}