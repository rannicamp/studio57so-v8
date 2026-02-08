//app\api\meta\ad-accounts\route.js

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(request) {
  // Pega a sessão do usuário para obter o token de acesso da Meta
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Não autorizado. Conecte sua conta da Meta.' }, { status: 401 });
  }

  const accessToken = session.accessToken;
  // Monta a URL para pedir à Meta a lista de contas de anúncio do usuário
  const url = `https://graph.facebook.com/v20.0/me/adaccounts?fields=name,account_id,currency,account_status&access_token=${accessToken}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Falha ao buscar contas de anúncio da Meta.');
    }

    // Retorna a lista de contas encontradas
    return NextResponse.json(data.data || []);

  } catch (error) {
    console.error('Erro na API /api/meta/ad-accounts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}