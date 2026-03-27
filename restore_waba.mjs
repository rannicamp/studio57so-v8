import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const TOKEN  = 'EAAdKmpfJpnQBRBnKsuSZCzt8OuCn4BnkIINu1G3YZAP4jtBkDn1NaZCKtzxMtaZCHK3BaEWXXh6wswYVEAmFkAo3rZAn7kIfib1MaRmGZCyUXvd2f2pFVrsfvcgD3ZB8haTv06jvdtQYFTsOvHfEnAkaf5fwX2bNH4IZBE8qBIAkAg8UVaA8e4Az5etAR5f8nwZDZD';
const WABA_ID = '1157736359732238';
const APP_SAAS_ID = '2052352668968564'; // ELO 57 - WATS (novo, vamos remover)
const APP_LEGADO_ID = '1518358099511142'; // CRM - Studio 57 (antigo, vamos adicionar)

async function restoreLegado() {
    console.log("=== RESTAURANDO WEBHOOK PARA STUDIO 57 (LEGADO) ===");
    
    // 1. Inscrevendo o CRM Clássico de volta
    console.log("1️⃣ Inscrevendo CRM - Studio 57 (" + APP_LEGADO_ID + ") na WABA...");
    const r1 = await fetch(`https://graph.facebook.com/v19.0/${WABA_ID}/subscribed_apps`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${process.env.META_PAGE_ACCESS_TOKEN || TOKEN}` }
    });
    // Observação: Para inscrever o app, a Graph API prefere o token de desenvolvedor do App Legado ou do System User se ele tiver acesso a ambos apps.
    // Mas vamos tentar com o System User Token
    const r2 = await fetch(`https://graph.facebook.com/v19.0/${WABA_ID}/subscribed_apps`, {
        method: 'POST',
        headers: { 
            "Authorization": `Bearer ${TOKEN}`,
            "Content-Type": "application/json"
        }
    });
    console.log("Resposta:", await r2.json());

    // 2. Removendo o App novo do ELO 57
    console.log("\n2️⃣ Removendo ELO 57 WATS (" + APP_SAAS_ID + ") da WABA...");
    const r3 = await fetch(`https://graph.facebook.com/v19.0/${WABA_ID}/subscribed_apps`, {
        method: 'DELETE',
        headers: { 
            "Authorization": `Bearer ${TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ app_id: APP_SAAS_ID })
    });
    console.log("Resposta Remocao:", await r3.json());
    
    // 3. Confirmando final
    console.log("\n3️⃣ Apps inscritos agora:");
    const r4 = await fetch(`https://graph.facebook.com/v19.0/${WABA_ID}/subscribed_apps`, {
        headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    const d4 = await r4.json();
    d4.data?.forEach(a => console.log(`   - ${a.whatsapp_business_api_data?.name} (${a.whatsapp_business_api_data?.id})`));
}
restoreLegado();
