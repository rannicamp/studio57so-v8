import { NextResponse } from 'next/server';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { ModelDerivativeClient } from '@aps_sdk/model-derivative';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';

const sdk = SdkManagerBuilder.create().build();
const authenticationClient = new AuthenticationClient(sdk);
const modelDerivativeClient = new ModelDerivativeClient(sdk);

export async function POST(request) {
 try {
 const { urn } = await request.json();

 if (!urn) {
 return NextResponse.json({ error: 'URN necessária' }, { status: 400 });
 }

 const credentials = await authenticationClient.getTwoLeggedToken(
 process.env.APS_CLIENT_ID,
 process.env.APS_CLIENT_SECRET,
 [Scopes.ViewablesRead]
 );

 // Busca o manifesto (o relatório de status da tradução)
 const manifest = await modelDerivativeClient.getManifest(
 urn,
 { accessToken: credentials.access_token }
 );

 // O status pode ser: 'pending', 'inprogress', 'success', 'failed', 'timeout'
 // O progress vai de 0% a "complete"
 return NextResponse.json({ status: manifest.status, progress: manifest.progress });

  } catch (error) {
    // Se o erro for 404 (Not Found), significa que a Autodesk ainda não iniciou a tradução da URN
    // Vamos disparar a tradução automaticamente no backend para destravar o processamento
    if (error.message && (error.message.includes('404') || error.message.includes('Not Found'))) {
      const { urn } = await request.clone().json().catch(() => ({}));
      if (urn) {
        console.log(`[APS STATUS API] URN 404 detectada: ${urn}. Disparando tradução automática...`);
        try {
          // 1. Autenticação para Escrita de Jobs
          const translateCreds = await authenticationClient.getTwoLeggedToken(
            process.env.APS_CLIENT_ID,
            process.env.APS_CLIENT_SECRET,
            [Scopes.DataRead, Scopes.DataWrite, Scopes.BucketCreate, Scopes.BucketRead]
          );
          
          // 2. Disparar Job na Autodesk Derivative API
          const derivativeUrl = 'https://developer.api.autodesk.com/modelderivative/v2/designdata/job';
          const translateRes = await fetch(derivativeUrl, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${translateCreds.access_token}`, 
              'Content-Type': 'application/json',
              'x-ads-force': 'true' 
            },
            body: JSON.stringify({ 
              input: { urn: urn }, 
              output: { 
                formats: [
                  { type: 'svf', views: ['2d', '3d'] },
                  { type: 'ifc' }
                ] 
              } 
            })
          });

          if (translateRes.ok) {
            console.log(`[APS STATUS API] Tradução automática disparada com sucesso para: ${urn}`);
            return NextResponse.json({ status: 'inprogress', progress: '0% complete' });
          } else {
            console.error(`[APS STATUS API] Falha ao disparar tradução automática: ${await translateRes.text()}`);
          }
        } catch (translateError) {
          console.error("[APS STATUS API] Erro ao tentar iniciar tradução automatizada:", translateError);
        }
      }
    }

    console.error("Erro ao checar status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}