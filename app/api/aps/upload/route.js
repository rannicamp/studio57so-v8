import { NextResponse } from 'next/server';

// Nome do Bucket (Mantive o mesmo para aproveitar se ele já foi criado)
const BUCKET_KEY = 'studio57-bim-projects-manager-v2';

// Função auxiliar para obter o Token
async function getInternalToken() {
    const { APS_CLIENT_ID, APS_CLIENT_SECRET } = process.env;
    const credentials = Buffer.from(`${APS_CLIENT_ID}:${APS_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'data:read data:write data:create bucket:create bucket:read viewables:read',
        }),
    });

    if (!response.ok) throw new Error(`Erro Auth Autodesk: ${response.statusText}`);
    const data = await response.json();
    return data.access_token;
}

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });

        console.log(`[APS] Iniciando upload moderno (S3): ${file.name}`);

        const buffer = Buffer.from(await file.arrayBuffer());
        const token = await getInternalToken();

        // 1. Verificar/Criar Bucket
        const checkBucket = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (checkBucket.status === 404) {
            console.log(`[APS] Criando bucket...`);
            await fetch(`https://developer.api.autodesk.com/oss/v2/buckets`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ bucketKey: BUCKET_KEY, policyKey: 'transient' }) 
            });
        }

        // --- NOVO FLUXO: DIRECT TO S3 (3 Passos) ---

        // Passo A: Pedir um link de upload assinado (Signed URL)
        console.log(`[APS] Passo A: Solicitando URL de upload...`);
        const signedUrlResponse = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${file.name}/signeds3upload`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!signedUrlResponse.ok) throw new Error(`Erro ao obter URL S3: ${await signedUrlResponse.text()}`);
        
        const signedData = await signedUrlResponse.json();
        const uploadUrl = signedData.urls[0]; // Link para upload
        const uploadKey = signedData.uploadKey; // Chave para confirmar depois

        // Passo B: Fazer o upload direto para esse link
        console.log(`[APS] Passo B: Enviando bytes para S3...`);
        const s3Upload = await fetch(uploadUrl, {
            method: 'PUT',
            body: buffer,
            // Importante: Não enviar Authorization header aqui, pois o link já é assinado
        });

        if (!s3Upload.ok) throw new Error(`Erro no upload S3: ${s3Upload.statusText}`);

        // Passo C: Avisar a Autodesk que terminamos (Finalize)
        console.log(`[APS] Passo C: Finalizando upload...`);
        const finalizeResponse = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${file.name}/signeds3upload`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ uploadKey: uploadKey })
        });

        if (!finalizeResponse.ok) throw new Error(`Erro ao finalizar upload: ${await finalizeResponse.text()}`);

        const objectData = await finalizeResponse.json();
        const objectId = objectData.objectId;
        const urn = Buffer.from(objectId).toString('base64').replace(/=/g, ''); // Remove padding extra se houver

        console.log(`[APS] Upload completo. URN: ${urn}`);

        // 3. Solicitar Tradução (Job) - Mantido igual
        console.log(`[APS] Iniciando tradução SVF...`);
        await fetch('https://developer.api.autodesk.com/modelderivative/v2/designdata/job', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: { urn: urn },
                output: { formats: [{ type: 'svf', views: ['2d', '3d'] }] }
            })
        });

        return NextResponse.json({ 
            success: true, 
            urn: urn,
            filename: file.name
        });

    } catch (error) {
        console.error('[APS Error Critical]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}