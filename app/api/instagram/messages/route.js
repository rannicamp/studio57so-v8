import { NextResponse } from 'next/server';

// Esta API irá receber o ID da conversa (thread) e o token de acesso da página
// para buscar as mensagens daquele chat.
export async function POST(request) {
  try {
    const { conversationId, pageAccessToken } = await request.json();

    if (!conversationId || !pageAccessToken) {
      return NextResponse.json({ error: 'ID da Conversa e Token de Acesso são obrigatórios.' }, { status: 400 });
    }

    // Usamos o ID da conversa para acessar as mensagens (messages)
    // Pedimos os campos 'from' (quem enviou), 'message' (o conteúdo) e 'created_time' (quando foi enviada)
    const url = `https://graph.facebook.com/v20.0/${conversationId}/messages?fields=from,message,created_time&access_token=${pageAccessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Falha ao buscar as mensagens da conversa.');
    }

    // Retorna a lista de mensagens da conversa
    return NextResponse.json(data);

  } catch (error) {
    console.error('Erro na API /api/instagram/messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}