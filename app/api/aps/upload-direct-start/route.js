import { NextResponse } from 'next/server';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';

export const dynamic = 'force-dynamic';

const APS_CLIENT_ID = process.env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
const BUCKET_KEY = (process.env.APS_BUCKET_KEY || 'studio57_bim_bucket_p_' + APS_CLIENT_ID).toLowerCase().replace(/[^a-z0-9_-]/g, '');

const sdkManager = SdkManagerBuilder.create().build();
const authClient = new AuthenticationClient(sdkManager);

export async function POST(request) {
 try {
 const { fileName } = await request.json();

 if (!fileName) {
 return NextResponse.json({ error: 'Nome do arquivo não fornecido.' }, { status: 400 });
 }

 // 1. Autenticação Autodesk
 const credentials = await authClient.getTwoLeggedToken(
 APS_CLIENT_ID,
 APS_CLIENT_SECRET,
 [Scopes.DataRead, Scopes.DataWrite, Scopes.BucketCreate, Scopes.BucketRead]
 );
 const accessToken = credentials.access_token;

 // 2. Garantir Bucket (Muda para persistente para nunca apagar)
 try {
 await fetch('https://developer.api.autodesk.com/oss/v2/buckets', {
 method: 'POST',
 headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
 body: JSON.stringify({ bucketKey: BUCKET_KEY, policyKey: 'persistent' })
 });
 } catch (e) {}

 // 3. Solicitar URL Assinada de Upload
 const objectKey = encodeURIComponent(fileName);
 const s3Url = `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${objectKey}/signeds3upload`;

 const startRes = await fetch(s3Url, {
 method: 'GET',
 headers: { 'Authorization': `Bearer ${accessToken}` }
 });
 if (!startRes.ok) throw new Error(`Erro Auth Autodesk: ${startRes.statusText}`);
 const startData = await startRes.json();
 const uploadUrl = startData.urls[0];
 const uploadKey = startData.uploadKey;

 return NextResponse.json({ uploadUrl, uploadKey,
 objectKey
 });

 } catch (error) {
 console.error('[APS GET UPLOAD URL ERROR]:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
