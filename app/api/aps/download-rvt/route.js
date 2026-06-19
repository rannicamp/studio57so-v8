import { NextResponse } from 'next/server';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';

export const dynamic = 'force-dynamic';

const APS_CLIENT_ID = process.env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET;

const sdkManager = SdkManagerBuilder.create().build();
const authClient = new AuthenticationClient(sdkManager);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const urn = searchParams.get('urn');

    if (!urn) {
      return NextResponse.json({ error: 'Parâmetro URN ausente.' }, { status: 400 });
    }

    // 1. Decodificar URN para extrair bucketKey e objectKey
    let base64 = urn;
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    
    let decoded;
    try {
      decoded = Buffer.from(base64, 'base64').toString('utf-8');
    } catch (e) {
      return NextResponse.json({ error: 'Erro ao decodificar a URN.' }, { status: 400 });
    }

    const prefix = 'urn:adsk.objects:os.object:';
    if (!decoded.startsWith(prefix)) {
      return NextResponse.json({ error: 'URN com formato inválido da Autodesk.' }, { status: 400 });
    }

    const relativePath = decoded.substring(prefix.length);
    const slashIdx = relativePath.indexOf('/');
    if (slashIdx === -1) {
      return NextResponse.json({ error: 'Estrutura interna da URN inválida.' }, { status: 400 });
    }

    const bucketKey = relativePath.substring(0, slashIdx);
    const objectKey = relativePath.substring(slashIdx + 1);

    // 2. Autenticação Autodesk (Token com escopo de leitura de dados)
    const credentials = await authClient.getTwoLeggedToken(
      APS_CLIENT_ID,
      APS_CLIENT_SECRET,
      [Scopes.DataRead]
    );
    const accessToken = credentials.access_token;

    // 3. Solicitar URL Assinada de Download S3
    const s3Url = `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3download`;

    const startRes = await fetch(s3Url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!startRes.ok) {
      const errorText = await startRes.text();
      throw new Error(`Falha Autodesk OSS: ${startRes.status} ${errorText}`);
    }

    const startData = await startRes.json();
    
    if (!startData.urls || startData.urls.length === 0) {
      throw new Error('Nenhuma URL de download retornada pela Autodesk.');
    }

    const downloadUrl = startData.urls[0];

    // 4. Redirecionar diretamente para a URL assinada do S3
    return NextResponse.redirect(downloadUrl);

  } catch (error) {
    console.error('[APS DOWNLOAD RVT ERROR]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
