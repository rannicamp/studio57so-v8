import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';

// Esta API irá receber o ID da Campanha e buscará os anúncios
export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Não autorizado. Conecte sua conta da Meta.' }, { status: 401 });
  }

  try {
    const { campaignId } = await request.json();
    if (!campaignId) {
      return NextResponse.json({ error: 'O ID da Campanha é obrigatório.' }, { status: 400 });
    }

    const accessToken = session.accessToken;
    // Montamos a URL para buscar os anúncios (ads) dentro da campanha
    // Pedimos os campos: nome do anúncio, status, e um sub-campo 'insights'
    // Dentro de 'insights', pedimos as métricas: spend (gasto), impressions (impressões), clicks, e cpc (custo por clique)
    const url = `https://graph.facebook.com/v20.0/${campaignId}/ads?fields=name,status,insights{spend,impressions,clicks,cpc}&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Falha ao buscar os anúncios da Meta.');
    }
    
    // A API da Meta pode retornar anúncios sem métricas se eles não rodaram.
    // Nós formatamos a resposta para garantir que os dados de 'insights' sempre existam.
    const formattedData = data.data.map(ad => ({
        ...ad,
        insights: ad.insights ? ad.insights.data[0] : { spend: '0', impressions: '0', clicks: '0', cpc: '0' }
    }));

    return NextResponse.json(formattedData || []);

  } catch (error) {
    console.error('Erro na API /api/meta/ads:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}