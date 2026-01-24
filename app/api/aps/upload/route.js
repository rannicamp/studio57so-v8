// Caminho: app/api/aps/upload/route.js
import { NextResponse } from 'next/server';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';

// --- CONFIGURAÇÕES CRÍTICAS (Evita Timeout) ---
export const maxDuration = 60; 
export const dynamic = 'force-dynamic';
// ---------------------------------------------

const APS_CLIENT_ID = process.env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET;

// Sanitização do bucket
const BUCKET_KEY = (process.env.APS_BUCKET_KEY || 'studio57_bim_bucket_' + APS_CLIENT_ID).toLowerCase().replace(/[^a-z0-9_-]/g, '');

const sdkManager = SdkManagerBuilder.create().build();
const authClient = new AuthenticationClient(sdkManager);

export async function POST(request) {
    try {
        // 1. Ler arquivo
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) return NextResponse.json({ error: 'Nenhum arquivo.' }, { status: 400 });

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Autenticação
        const credentials = await authClient.getTwoLeggedToken(
            APS_CLIENT_ID,
            APS_CLIENT_SECRET,
            [Scopes.DataRead, Scopes.DataWrite, Scopes.BucketCreate, Scopes.BucketRead]
        );
        const accessToken = credentials.access_token;

        // 3. Garantir Bucket (Via Fetch)
        try {
            await fetch('https://developer.api.autodesk.com/oss/v2/buckets', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bucketKey: BUCKET_KEY,
                    policyKey: 'transient'
                })
            });
        } catch (e) { /* Ignora se já existir */ }

        // =====================================================================
        // 4. UPLOAD MODERNO (DIRECT TO S3) - 3 ETAPAS
        // =====================================================================
        
        const objectKey = encodeURIComponent(file.name);
        // Endpoint Base
        const s3Url = `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${objectKey}/signeds3upload`;

        // ETAPA A: Obter URL assinada
        const startRes = await fetch(s3Url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!startRes.ok) {
            const err = await startRes.text();
            throw new Error(`Erro ao iniciar S3 Upload: ${err}`);
        }

        const startData = await startRes.json();
        const uploadUrl = startData.urls[0]; // URL da Amazon S3
        const uploadKey = startData.uploadKey;

        // ETAPA B: Enviar o binário para a Amazon S3 (Diretamente)
        const s3UploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: buffer,
            headers: {
                // S3 exige que não tenha Authorization header aqui, ou headers conflitantes
                // O tipo é binário puro
            }
        });

        if (!s3UploadRes.ok) {
            throw new Error(`Erro no envio para S3: ${s3UploadRes.status}`);
        }

        // ETAPA C: Finalizar o Upload na Autodesk
        const finalizeRes = await fetch(s3Url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uploadKey: uploadKey })
        });

        if (!finalizeRes.ok) {
            const err = await finalizeRes.text();
            throw new Error(`Erro ao finalizar S3 Upload: ${err}`);
        }

        const objectDetails = await finalizeRes.json();
        // =====================================================================

        // 5. Preparar URN
        const objectId = objectDetails.objectId;
        const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');

        // 6. Tradução
        await iniciarTraducao(urn, accessToken);

        return NextResponse.json({ 
            success: true, 
            urn: urn, 
            objectId: objectId 
        });

    } catch (error) {
        console.error('[APS UPLOAD ERROR]:', error);
        return NextResponse.json({ error: error.message || "Erro desconhecido" }, { status: 500 });
    }
}

async function iniciarTraducao(urn, accessToken) {
    const url = 'https://developer.api.autodesk.com/modelderivative/v2/designdata/job';
    const body = {
        input: { urn: urn },
        output: { formats: [{ type: 'svf', views: ['2d', '3d'] }] }
    };

    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'x-ads-force': 'true'
            },
            body: JSON.stringify(body)
        });
    } catch (e) {
        console.log("Aviso Job:", e.message);
    }
}