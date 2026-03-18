import { NextResponse } from 'next/server';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Evita o erro 504 Gateway Timeout da Netlify/Vercel

const APS_CLIENT_ID = process.env.APS_CLIENT_ID;
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
const BUCKET_KEY = (process.env.APS_BUCKET_KEY || 'studio57_bim_bucket_p_' + APS_CLIENT_ID).toLowerCase().replace(/[^a-z0-9_-]/g, '');

const sdkManager = SdkManagerBuilder.create().build();
const authClient = new AuthenticationClient(sdkManager);

export async function POST(request) {
    try {
        const { uploadKey, objectKey } = await request.json();

        if (!uploadKey || !objectKey) {
            return NextResponse.json({ error: 'Parâmetros ausentes.' }, { status: 400 });
        }

        // 1. Autenticação Autodesk
        const credentials = await authClient.getTwoLeggedToken(
            APS_CLIENT_ID,
            APS_CLIENT_SECRET,
            [Scopes.DataRead, Scopes.DataWrite, Scopes.BucketCreate, Scopes.BucketRead]
        );
        const accessToken = credentials.access_token;

        // 2. Finaliza S3 Upload na Autodesk
        const s3Url = `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${objectKey}/signeds3upload`;
        const finalizeRes = await fetch(s3Url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadKey: uploadKey })
        });
        
        if (!finalizeRes.ok) {
            throw new Error(`Erro ao finalizar S3 Upload: ${await finalizeRes.text()}`);
        }

        const objectDetails = await finalizeRes.json();

        // 3. Gera URN Seguro
        const objectId = objectDetails.objectId;
        const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');

        return NextResponse.json({ success: true, urn: urn });

    } catch (error) {
        console.error('[APS FINALIZE UPLOAD ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
