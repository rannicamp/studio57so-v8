import { NextResponse } from 'next/server';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { ModelDerivativeClient } from '@aps_sdk/model-derivative';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';
import { createAdminClient } from '@/utils/supabase/server';

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
            const errorText = await translateRes.text();
            console.error(`[APS STATUS API] Falha ao disparar tradução automática: ${errorText}`);
            
            // Se for erro de créditos (403), atualizamos o status do projeto no banco de dados para Erro
            let statusText = 'Erro ao disparar tradução';
            if (errorText.includes('ProductAccessRequiresCapacity') || errorText.includes('Token exchange denied')) {
              statusText = 'Erro (Autodesk sem créditos)';
              
              try {
                const supabaseAdmin = createAdminClient();
                const { error: dbError } = await supabaseAdmin
                  .from('projetos_bim')
                  .update({ status: statusText })
                  .or(`urn_autodesk.eq.${urn},urn_autodesk.eq.urn:${urn}`);
                
                if (dbError) {
                  console.error('[APS STATUS API] Erro ao atualizar status no banco:', dbError);
                } else {
                  console.log(`[APS STATUS API] Status atualizado no banco para "${statusText}" para a URN ${urn}`);
                }
              } catch (dbEx) {
                console.error('[APS STATUS API] Falha ao instanciar admin client ou rodar update:', dbEx);
              }
            }
            
            return NextResponse.json({ status: 'failed', error: statusText, details: errorText }, { status: 403 });
          }
        } catch (translateError) {
          console.error("[APS STATUS API] Erro ao tentar iniciar tradução automatizada:", translateError);
          return NextResponse.json({ status: 'failed', error: translateError.message }, { status: 500 });
        }
      }
    }

    console.error("Erro ao checar status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}