import { NextResponse } from 'next/server';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const APS_CLIENT_ID = process.env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET;

const sdkManager = SdkManagerBuilder.create().build();
const authClient = new AuthenticationClient(sdkManager);

export async function POST(request) {
 try {
 const { urn } = await request.json();

 if (!urn) {
 return NextResponse.json({ error: 'Parâmetro URN ausente.' }, { status: 400 });
 }

 // 1. Autenticação Autodesk
 const credentials = await authClient.getTwoLeggedToken(
 APS_CLIENT_ID,
 APS_CLIENT_SECRET,
 [Scopes.DataRead, Scopes.DataWrite, Scopes.BucketCreate, Scopes.BucketRead]
 );
 const accessToken = credentials.access_token;

 // 2. Iniciar Tarefa de Tradução (Derivative API)
 const derivativeUrl = 'https://developer.api.autodesk.com/modelderivative/v2/designdata/job';
 const translateRes = await fetch(derivativeUrl, {
 method: 'POST',
 headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'x-ads-force': 'true' },
 body: JSON.stringify({ input: { urn: urn }, output: { formats: [{ type: 'svf', views: ['2d', '3d'] }] } })
 });

 if (!translateRes.ok) {
 const errorText = await translateRes.text();
 throw new Error(`Erro na tradução APS: ${errorText}`);
 }

 return NextResponse.json({ success: true, urn: urn, status: 'started' });

 } catch (error) {
 console.error('[APS TRANSLATE ERROR]:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
