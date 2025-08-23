import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';

// Esta função será a nossa API para buscar as contas
export async function GET(request) {
  // 1. Pegamos a sessão do usuário para garantir que ele está logado com o Facebook
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Não autorizado. Faça login com o Facebook/Meta.' }, { status: 401 });
  }

  const accessToken = session.accessToken;
  const url = `https://graph.facebook.com/v20.0/me/accounts?fields=instagram_business_account{name,username,profile_picture_url},access_token&access_token=${accessToken}`;

  try {
    // 2. Fazemos a chamada para a API da Meta
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Falha ao buscar contas da Meta.');
    }

    // 3. Filtramos e retornamos apenas as contas que têm um Instagram vinculado
    const instagramAccounts = data.data
      .filter(page => page.instagram_business_account)
      .map(page => ({
        page_id: page.id,
        page_access_token: page.access_token,
        instagram_id: page.instagram_business_account.id,
        name: page.instagram_business_account.name,
        username: page.instagram_business_account.username,
        profile_picture_url: page.instagram_business_account.profile_picture_url,
      }));

    return NextResponse.json(instagramAccounts);

  } catch (error) {
    console.error('Erro na API /api/instagram/accounts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}