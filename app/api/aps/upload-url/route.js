import { NextResponse } from 'next/server';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

const APS_CLIENT_ID = process.env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
const BUCKET_KEY = (process.env.APS_BUCKET_KEY || 'studio57_bim_bucket_' + APS_CLIENT_ID).toLowerCase().replace(/[^a-z0-9_-]/g, '');

const sdkManager = SdkManagerBuilder.create().build();
const authClient = new AuthenticationClient(sdkManager);

export async function POST(request) {
    try {
        // 1. Recebe APENAS a URL e o Nome (Payload levíssimo, KB)
        const { fileUrl, fileName } = await request.json();

        if (!fileUrl || !fileName) {
            return NextResponse.json({ error: 'URL ou Nome faltando.' }, { status: 400 });
        }

        console.log(`🚀 Iniciando Upload via URL: ${fileName}`);

        // 2. Autenticação Autodesk
        const credentials = await authClient.getTwoLeggedToken(
            APS_CLIENT_ID,
            APS_CLIENT_SECRET,
            [Scopes.DataRead, Scopes.DataWrite, Scopes.BucketCreate, Scopes.BucketRead]
        );
        const accessToken = credentials.access_token;

        // 3. Garantir Bucket
        try {
            await fetch('https://developer.api.autodesk.com/oss/v2/buckets', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ bucketKey: BUCKET_KEY, policyKey: 'transient' })
            });
        } catch (e) {}

        // =====================================================================
        // 4. STREAMING DO ARQUIVO (SUPABASE -> SERVIDOR -> AUTODESK S3)
        // =====================================================================
        
        // A. Baixa o arquivo do Supabase (como Stream)
        const supabaseRes = await fetch(fileUrl);
        if (!supabaseRes.ok) throw new Error(`Erro ao baixar do Supabase: ${supabaseRes.statusText}`);
        
        // B. Inicia Upload S3 na Autodesk
        const objectKey = encodeURIComponent(fileName);
        const s3Url = `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${objectKey}/signeds3upload`;

        const startRes = await fetch(s3Url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const startData = await startRes.json();
        const uploadUrl = startData.urls[0];
        const uploadKey = startData.uploadKey;

        // C. Pipe do Supabase para Autodesk (Sem estourar memória)
        // Convertemos o stream do Supabase para ArrayBuffer para envio seguro ao S3
        // Nota: Em Node puro usaríamos pipe, mas no Edge/Serverless o ArrayBuffer é mais compatível
        const fileBuffer = await supabaseRes.arrayBuffer();

        const s3UploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: fileBuffer, // Envia o buffer baixado
            // Importante: Não enviar Authorization header para o S3
        });

        if (!s3UploadRes.ok) throw new Error(`Erro Amazon S3: ${s3UploadRes.statusText}`);

        // D. Finaliza Upload
        const finalizeRes = await fetch(s3Url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadKey: uploadKey })
        });
        
        const objectDetails = await finalizeRes.json();

        // 5. Gera URN e Traduz
        const objectId = objectDetails.objectId;
        const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');

        await iniciarTraducao(urn, accessToken);

        return NextResponse.json({ success: true, urn: urn });

    } catch (error) {
        console.error('[APS URL UPLOAD ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function iniciarTraducao(urn, accessToken) {
    const url = 'https://developer.api.autodesk.com/modelderivative/v2/designdata/job';
    await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'x-ads-force': 'true' },
        body: JSON.stringify({ input: { urn: urn }, output: { formats: [{ type: 'svf', views: ['2d', '3d'] }] } })
    });
}