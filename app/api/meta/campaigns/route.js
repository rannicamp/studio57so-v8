//app\api\meta\campaigns\route.js

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';

// Esta API irá receber o ID da Conta de Anúncio e buscará as campanhas
export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Não autorizado. Conecte sua conta da Meta.' }, { status: 401 });
  }

  try {
    const { adAccountId } = await request.json();
    if (!adAccountId) {
      return NextResponse.json({ error: 'O ID da Conta de Anúncio é obrigatório.' }, { status: 400 });
    }

    const accessToken = session.accessToken;
    // Montamos a URL usando o ID da conta de anúncio para buscar as campanhas
    // Pedimos os campos: nome da campanha, status (ativa/pausada), e o objetivo
    const url = `https://graph.facebook.com/v20.0/${adAccountId}/campaigns?fields=name,status,objective&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Falha ao buscar campanhas da Meta.');
    }

    // Retorna a lista de campanhas encontradas
    return NextResponse.json(data.data || []);

  } catch (error) {
    console.error('Erro na API /api/meta/campaigns:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}