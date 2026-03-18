import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager';

const sdk = SdkManagerBuilder.create().build();
const authenticationClient = new AuthenticationClient(sdk);

async function test() {
    try {
        const credentials = await authenticationClient.getTwoLeggedToken(
            process.env.APS_CLIENT_ID,
            process.env.APS_CLIENT_SECRET,
            [Scopes.ViewablesRead]
        );
        console.log("Credentials:", credentials);
    } catch (e) {
        console.error(e);
    }
}
test();
