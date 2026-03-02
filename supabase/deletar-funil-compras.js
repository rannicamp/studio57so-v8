const { Client } = require('pg');
const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const db = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await db.connect();

    // Primeiro, mostra o que vai ser deletado
    const { rows } = await db.query("SELECT id, nome FROM funis WHERE nome ILIKE '%compras%'");
    console.log('Funis encontrados:', JSON.stringify(rows));

    if (rows.length === 0) {
        console.log('Nenhum funil com "compras" encontrado.');
        await db.end();
        return;
    }

    for (const funil of rows) {
        // Deleta as colunas vinculadas primeiro (CASCADE pode não estar ativo)
        const { rowCount: cols } = await db.query('DELETE FROM colunas_funil WHERE funil_id = $1', [funil.id]);
        console.log(`Deletadas ${cols} colunas do funil "${funil.nome}"`);

        // Deleta o funil
        await db.query('DELETE FROM funis WHERE id = $1', [funil.id]);
        console.log(`Funil "${funil.nome}" (id: ${funil.id}) DELETADO.`);
    }

    await db.end();
    console.log('Concluido!');
}

run().catch(e => console.error('ERRO:', e.message));
