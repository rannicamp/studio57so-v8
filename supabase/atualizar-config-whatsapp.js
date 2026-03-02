const { Client } = require('pg');
const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const db = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await db.connect();

    const phoneId = "690198827516149";
    const token = "EAAVk8Espx2YBQ0uW7uSYzSk8ZAvYdgh5epiplWndZBkb8IxEic9ZC4mD2YK5Q1ccKowxZAUD3hCIwSwI3v5kajYHKQPL31TMgPcAQYJs23LqjBpZAXYY6LZA8umwIpUYKxDY0I9OuXZANB8cSIUQZBEd7IEZCtRaYrxlDIZCqFpemHexQgJif1raQUOKK1eRVSf94qQejGxuAJZBA9aeEr69FsvDEb4d7RsRhAH8O2khiZCH21ORS9crBhQueW7ApBk4tA8K1RQC8CCkOXj941HC7fKZCp2ZCSP0q2ZAZCZBstASgZBQAZD";

    // Pega a primeira organização (provavelmente a Studio 57)
    const { rows: orgs } = await db.query('SELECT id, nome FROM organizacoes ORDER BY created_at ASC LIMIT 1');
    if (orgs.length === 0) {
        console.log("Nenhuma organização encontrada!");
        await db.end();
        return;
    }
    const orgId = orgs[0].id;
    console.log(`Atualizando configuracao WhatsApp para org: ${orgs[0].nome} (ID: ${orgId})`);

    // Faz um UPDATE direto
    const query = `
        UPDATE configuracoes_whatsapp 
        SET 
            whatsapp_phone_number_id = $2,
            whatsapp_permanent_token = $3
        WHERE organizacao_id = $1
        RETURNING id;
    `;

    const { rows: config } = await db.query(query, [orgId, phoneId, token]);

    if (config.length > 0) {
        console.log(`✅ Sucesso! Configuracao atualizada (ID config: ${config[0].id})`);
        console.log(`- Novo Phone ID: ${phoneId}`);
    } else {
        console.log(`⚠️ Falha: Nenhuma configuracao encontrada para a org_id ${orgId}`);
    }

    await db.end();
}

run().catch(e => console.error('ERRO:', e.message));
