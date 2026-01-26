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
            credentials.access_token,
            urn
        );

        // O status pode ser: 'pending', 'inprogress', 'success', 'failed', 'timeout'
        // O progress vai de 0% a "complete"
        return NextResponse.json({ 
            status: manifest.status, 
            progress: manifest.progress 
        });

    } catch (error) {
        console.error("Erro ao checar status:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}