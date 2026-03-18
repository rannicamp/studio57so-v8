import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { ModelDerivativeClient } from '@aps_sdk/model-derivative';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';
import fs from 'fs';

const sdk = SdkManagerBuilder.create().build();
const authenticationClient = new AuthenticationClient(sdk);
const modelDerivativeClient = new ModelDerivativeClient(sdk);

async function test() {
    try {
        const credentials = await authenticationClient.getTwoLeggedToken(
            process.env.APS_CLIENT_ID,
            process.env.APS_CLIENT_SECRET,
            [Scopes.ViewablesRead]
        );
        const urn = "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6c3R1ZGlvNTdfYmltX2J1Y2tldF9wX2phdXQ5d3MwOHJqemRvbnpld2FuanVnN2JrZHYzMnl0MHVuZGRhNjl5MnZlc2ViYy8yMDIxXzAxNV9MSU5LJTIwMDJfQVJRVUlURVRVUkElMjBGT1JSTy5ydnQ";
        
        const manifest = await modelDerivativeClient.getManifest(
            credentials.access_token,
            urn
        );
        fs.writeFileSync('c:\\Projetos\\studio57so-v8\\scripts\\check_sdk.log', "SUCESSO: " + manifest.status);
    } catch (e) {
        fs.writeFileSync('c:\\Projetos\\studio57so-v8\\scripts\\check_sdk.log', "ERRO: " + (e.stack || e.message));
    }
}
test();
