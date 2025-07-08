// app/api/whatsapp/send.js

import { NextResponse } from 'next/server';

// Esta é a função que receberá as solicitações para enviar mensagens
export async function POST(request) {
  // Mais tarde, vamos pegar as informações da mensagem (para quem enviar, o que enviar) aqui
  const body = await request.json(); 
  const { to, templateName } = body;

  // As credenciais virão de um lugar seguro, não direto no código
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Verificamos se as credenciais estão configuradas
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return NextResponse.json(
      { error: 'As credenciais do WhatsApp não estão configuradas no servidor.' },
      { status: 500 }
    );
  }

  // AVISO: A lógica para enviar a mensagem de verdade virá aqui nos próximos passos.
  // Por enquanto, vamos apenas retornar uma mensagem de sucesso para teste.
  console.log(`Simulando envio para: ${to} com o modelo: ${templateName}`);

  // Retorna uma resposta de sucesso
  return NextResponse.json({
    message: 'Rota de envio de WhatsApp funcionando!',
    sentTo: to,
    template: templateName,
  });
}