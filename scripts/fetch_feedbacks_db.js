require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

function getPassword() {
    if (process.env.SUPABASE_DB_PASSWORD) return process.env.SUPABASE_DB_PASSWORD;
    try {
        if (fs.existsSync('.env.db')) {
            const dbEnv = fs.readFileSync('.env.db', 'utf8');
            const match = dbEnv.match(/SUPABASE_DB_PASSWORD=(.+)/);
            if (match) return match[1].trim();
        }
    } catch { }
    return null;
}

async function fetchFeedbacks() {
    const password = getPassword();
    if (!password) {
        console.error('Password not found');
        process.exit(1);
    }
    const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
    const projectId = baseHost.split('.')[0];
    const host = `db.${projectId}.supabase.co`;
    const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

    const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }  });
    await client.connect();

    // Query un-diagnosed and all pending tickets
    const res = await client.query(`
        SELECT f.id, f.status, f.created_at, f.pagina, f.descricao, f.anexo_url, f.diagnostico, f.plano_solucao, f.comentarios,
               (SELECT nome FROM usuarios u WHERE u.id = f.usuario_id) as autor_nome
        FROM feedback f
        WHERE f.status IN ('Novo', 'Em Análise')
        ORDER BY f.created_at DESC;
    `);

    fs.writeFileSync('feedbacks_raw.json', JSON.stringify(res.rows, null, 2));
    console.log('Fetched ' + res.rows.length + ' pending feedbacks.');
    await client.end();
}

fetchFeedbacks().catch(console.error);
