import { NextResponse } from 'next/server';

// Esta API irá receber o ID da conta do Instagram e o token de acesso da página
// para buscar as conversas.
export async function POST(request) {
  try {
    const { instagramAccountId, pageAccessToken } = await request.json();

    if (!instagramAccountId || !pageAccessToken) {
      return NextResponse.json({ error: 'ID da conta do Instagram e Token de Acesso são obrigatórios.' }, { status: 400 });
    }

    // A API da Meta usa o ID da conta do Instagram para encontrar as conversas (threads)
    const url = `https://graph.facebook.com/v20.0/${instagramAccountId}/conversations?platform=instagram&fields=participants,snippet,unread_count,message_count&access_token=${pageAccessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Falha ao buscar as conversas no Instagram.');
    }

    // Retorna a lista de conversas encontradas
    return NextResponse.json(data);

  } catch (error) {
    console.error('Erro na API /api/instagram/conversations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}