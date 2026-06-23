import { NextResponse } from 'next/server';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';

export const dynamic = 'force-dynamic';

const APS_CLIENT_ID = process.env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET;

const sdkManager = SdkManagerBuilder.create().build();
const authClient = new AuthenticationClient(sdkManager);

export async function POST(request) {
  try {
    const { urn } = await request.json();

    if (!urn) {
      return NextResponse.json({ error: 'URN não fornecida.' }, { status: 400 });
    }

    console.log(`[APS DELETE OBJECT]: Solicitada exclusão física da URN: ${urn}`);

    // 1. Decodificar URN resiliente para obter o objectId
    let base64 = urn;
    // Se o base64 conter caracteres url safe, substitui
    base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

    let objectId;
    try {
      objectId = Buffer.from(base64, 'base64').toString('utf-8');
    } catch (err) {
      console.error(`[APS DELETE OBJECT] Falha ao decodificar base64 da URN ${urn}:`, err);
      return NextResponse.json({ error: 'Decodificação da URN falhou' }, { status: 400 });
    }

    const prefix = 'urn:adsk.objects:os.object:';
    if (!objectId.startsWith(prefix)) {
      console.warn(`[APS DELETE OBJECT] objectId inválido (não inicia com prefixo esperado): ${objectId}`);
      return NextResponse.json({ error: 'URN decodificada inválida' }, { status: 400 });
    }

    const resourcePath = objectId.substring(prefix.length);
    const slashIndex = resourcePath.indexOf('/');
    if (slashIndex === -1) {
      console.warn(`[APS DELETE OBJECT] objectId mal formatado: ${objectId}`);
      return NextResponse.json({ error: 'Formato do objectId inválido' }, { status: 400 });
    }

    const bucketKey = resourcePath.substring(0, slashIndex);
    const objectKey = resourcePath.substring(slashIndex + 1);

    console.log(`[APS DELETE OBJECT] Decodificado com sucesso: Bucket = ${bucketKey}, ObjectKey = ${objectKey}`);

    // 2. Autenticação Autodesk
    const credentials = await authClient.getTwoLeggedToken(
      APS_CLIENT_ID,
      APS_CLIENT_SECRET,
      [Scopes.DataRead, Scopes.DataWrite]
    );
    const accessToken = credentials.access_token;

    // 3. Executar DELETE no OSS da Autodesk
    const deleteUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}`;
    const deleteRes = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!deleteRes.ok) {
      const errorText = await deleteRes.text();
      console.error(`[APS DELETE OBJECT] Falha na deleção Autodesk OSS (Status ${deleteRes.status}):`, errorText);
      // Se for 404 (Objeto já não existe), retornamos sucesso de forma limpa para não travar o frontend
      if (deleteRes.status === 404) {
        return NextResponse.json({ success: true, message: 'Objeto já não existia na Autodesk.' });
      }
      throw new Error(`Erro na deleção do objeto na Autodesk: ${deleteRes.statusText} (${errorText})`);
    }

    console.log(`[APS DELETE OBJECT] Objeto deletado fisicamente com sucesso da Autodesk!`);
    return NextResponse.json({ success: true, message: 'Objeto excluído fisicamente com sucesso na Autodesk.' });

  } catch (error) {
    console.error('[APS DELETE OBJECT ERROR]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
