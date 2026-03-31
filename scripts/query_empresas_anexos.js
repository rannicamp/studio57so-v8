require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function queryEmpresasAnexos() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) return;

    try {
        const response = await fetch(`${url}/rest/v1/empresa_anexos?select=*&organizacao_id=in.(1,2)`, {
            method: 'GET',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        const data = await response.json();
        fs.writeFileSync('temp_empresa_anexos.json', JSON.stringify(data, null, 2));
        console.log("Arquivo salvo: temp_empresa_anexos.json");
    } catch (e) {
        console.error("Erro:", e);
    }
}

queryEmpresasAnexos();
