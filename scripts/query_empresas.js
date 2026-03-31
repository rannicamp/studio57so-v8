require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function getEmpresas() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
        const response = await fetch(`${url}/rest/v1/cadastro_empresa?select=id,cnpj,razao_social,nome_fantasia&organizacao_id=in.(1,2)`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        const data = await response.json();
        console.table(data);
        fs.writeFileSync('temp_empresas.json', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

getEmpresas();
