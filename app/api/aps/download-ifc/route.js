import { NextResponse } from 'next/server';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { ModelDerivativeClient } from '@aps_sdk/model-derivative';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';

export const dynamic = 'force-dynamic';

const APS_CLIENT_ID = process.env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET;

const sdkManager = SdkManagerBuilder.create().build();
const authClient = new AuthenticationClient(sdkManager);
const modelDerivativeClient = new ModelDerivativeClient(sdkManager);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const urn = searchParams.get('urn');
    const filename = searchParams.get('filename') || 'modelo.ifc';
    const isOriginalIfc = searchParams.get('isOriginalIfc') === 'true';

    if (!urn) {
      return NextResponse.json({ error: 'Parâmetro URN ausente.' }, { status: 400 });
    }

    // 1. Autenticação Autodesk (Token com escopo de leitura e criação de derivações)
    const credentials = await authClient.getTwoLeggedToken(
      APS_CLIENT_ID,
      APS_CLIENT_SECRET,
      [Scopes.DataRead, Scopes.DataWrite, Scopes.ViewablesRead]
    );
    const accessToken = credentials.access_token;

    // 2. Se o modelo original já for um arquivo IFC, baixamos o original direto do OSS S3
    if (isOriginalIfc) {
      // Decodificar URN para extrair bucketKey e objectKey
      let base64 = urn;
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
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

      return NextResponse.redirect(startData.urls[0]);
    }

    // 3. Caso contrário (original é RVT), buscamos a derivative de IFC no manifesto
    let manifest;
    try {
      manifest = await modelDerivativeClient.getManifest(urn, { accessToken });
    } catch (err) {
      // Se não achar o manifesto, é porque a tradução geral nunca foi iniciada
      return NextResponse.json({ success: false, status: 'not_started', message: 'Projeto não processado na Autodesk.' });
    }

    // Procurar derivative de IFC
    const derivatives = manifest.derivatives || [];
    const ifcDerivative = derivatives.find(d => d.outputType === 'ifc');

    // Se a derivative do IFC não existir no manifesto, iniciamos a tradução para IFC
    if (!ifcDerivative) {
      const derivativeJobUrl = 'https://developer.api.autodesk.com/modelderivative/v2/designdata/job';
      
      const translateRes = await fetch(derivativeJobUrl, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${accessToken}`, 
          'Content-Type': 'application/json',
          'x-ads-force': 'true' 
        },
        body: JSON.stringify({ 
          input: { urn: urn }, 
          output: { 
            formats: [
              { type: 'ifc' }
            ] 
          } 
        })
      });

      if (!translateRes.ok) {
        const errorText = await translateRes.text();
        console.error('[APS IFC Job Error]:', errorText);
        return NextResponse.json({ success: false, status: 'error', error: 'Erro ao disparar conversão IFC na Autodesk.' });
      }

      return NextResponse.json({ success: false, status: 'processing', message: 'Conversão para IFC iniciada na Autodesk.' });
    }

    // Se a derivative existe mas ainda está processando
    if (ifcDerivative.status === 'pending' || ifcDerivative.status === 'inprogress') {
      return NextResponse.json({ success: false, status: 'processing', progress: ifcDerivative.progress });
    }

    // Se a tradução do IFC falhou
    if (ifcDerivative.status === 'failed' || ifcDerivative.status === 'timeout') {
      return NextResponse.json({ 
        success: false, 
        status: 'failed', 
        error: 'A conversão para IFC falhou no servidor da Autodesk. Tente reenviar o modelo.' 
      });
    }

    // Se estiver Concluído (success)
    if (ifcDerivative.status === 'success') {
      const derivativeUrn = ifcDerivative.urn || (ifcDerivative.children && ifcDerivative.children[0] && ifcDerivative.children[0].urn);
      
      if (!derivativeUrn) {
        throw new Error('URN da derivative IFC não encontrada no manifesto.');
      }

      // Solicitar Signed Cookies para o derivative URN
      const signedCookiesRes = await fetch(
        `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest/${encodeURIComponent(derivativeUrn)}/signedcookies`, 
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );

      if (!signedCookiesRes.ok) {
        throw new Error(`Erro ao gerar cookies assinados: ${signedCookiesRes.statusText}`);
      }

      const body = await signedCookiesRes.json();
      const downloadUrlBase = body.url;

      // Extrair cookies de assinatura do CloudFront
      const setCookies = signedCookiesRes.headers.getSetCookie();
      let policy = '';
      let keyPairId = '';
      let signature = '';

      setCookies.forEach(cookieStr => {
        const parts = cookieStr.split(';')[0].split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          if (key === 'CloudFront-Policy') policy = val;
          if (key === 'CloudFront-Key-Pair-Id') keyPairId = val;
          if (key === 'CloudFront-Signature') signature = val;
        }
      });

      // Se não vieram cookies e a URL já vier assinada por algum motivo
      if (!policy && !signature) {
        return NextResponse.json({ success: true, downloadUrl: downloadUrlBase });
      }

      // Montar a URL CloudFront autossuficiente com parâmetros na query string
      const queryParams = new URLSearchParams({
        Policy: policy,
        'Key-Pair-Id': keyPairId,
        Signature: signature,
        'response-content-disposition': `attachment; filename="${encodeURIComponent(filename)}"`
      });

      const finalDownloadUrl = `${downloadUrlBase}?${queryParams.toString()}`;

      return NextResponse.json({ success: true, downloadUrl: finalDownloadUrl });
    }

    return NextResponse.json({ success: false, status: 'error', error: 'Estado de tradução desconhecido.' });

  } catch (error) {
    console.error('[APS DOWNLOAD IFC ERROR]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
