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
        // --- MUDANÇA CRÍTICA AQUI ---
        // Antes: lia formData() (arquivo binário) -> Estoura memória/tempo
        // Agora: lê json() (apenas o link) -> Leve e rápido
        
        // Verifica se o content-type é JSON (o novo modal manda JSON)
        const contentType = request.headers.get('content-type') || '';
        
        let fileUrl, fileName;

        if (contentType.includes('application/json')) {
            const body = await request.json();
            fileUrl = body.fileUrl;
            fileName = body.fileName;
        } else {
            // Fallback para código antigo (se alguém usar upload antigo)
            // Mas recomendo remover isso para evitar erros de memória
            return NextResponse.json({ error: 'Por favor, use o novo método de upload via URL.' }, { status: 400 });
        }

        if (!fileUrl || !fileName) {
            return NextResponse.json({ error: 'URL ou Nome do arquivo faltando.' }, { status: 400 });
        }

        console.log(`🚀 Iniciando Processamento Autodesk para: ${fileName}`);

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
        // 4. STREAMING DO SUPABASE -> AUTODESK (Sem carregar na memória)
        // =====================================================================
        
        // A. Baixa o arquivo do Supabase (Stream)
        const supabaseRes = await fetch(fileUrl);
        if (!supabaseRes.ok) throw new Error(`Erro ao baixar do Supabase: ${supabaseRes.statusText}`);
        
        // B. Inicia Upload S3 na Autodesk
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

        // C. Pipe do Supabase para Autodesk
        // Convertemos o stream para ArrayBuffer (mais compatível com Serverless Edge)
        const fileBuffer = await supabaseRes.arrayBuffer();

        const s3UploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: fileBuffer,
            // Header vazio para S3 (importante)
        });

        if (!s3UploadRes.ok) throw new Error(`Erro Upload S3: ${s3UploadRes.statusText}`);

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
        console.error('[APS UPLOAD ERROR]:', error);
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