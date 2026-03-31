require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function querySupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) return;

    try {
        const response = await fetch(`${url}/rest/v1/documento_tipos?select=id,sigla,descricao&organizacao_id=in.(1,2)`, {
            method: 'GET',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        const data = await response.json();
        fs.writeFileSync('temp_categorias.json', JSON.stringify(data, null, 2));
        console.log("Categorias salvas em temp_categorias.json");
    } catch (e) {
        console.error("Erro:", e);
    }
}

querySupabase();
