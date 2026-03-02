const { Client } = require('pg');
const fs = require('fs');
const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const db = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await db.connect();

    const { rows } = await db.query(`
        SELECT 
            receiver_id,
            content,
            error_message,
            raw_payload,
            sent_at::text
        FROM whatsapp_messages
        WHERE status = 'failed'
          AND sent_at > NOW() - INTERVAL '7 days'
        ORDER BY sent_at DESC
        LIMIT 20
    `);

    const { rows: resumo } = await db.query(`
        SELECT 
            error_message,
            COUNT(*) as total,
            COUNT(DISTINCT receiver_id) as numeros
        FROM whatsapp_messages
        WHERE status = 'failed'
          AND sent_at > NOW() - INTERVAL '30 days'
        GROUP BY error_message
        ORDER BY total DESC
    `);

    const output = {
        falhas_recentes: rows,
        resumo_erros: resumo
    };

    fs.writeFileSync('/tmp/whatsapp-falhas.json', JSON.stringify(output, null, 2));
    console.log('Salvo em /tmp/whatsapp-falhas.json');
    console.log('\nRESUMO:');
    resumo.forEach(r => console.log(`  "${r.error_message}" → ${r.total}x`));

    console.log('\nDETALHES RECENTES:');
    rows.forEach((r, i) => {
        const raw = r.raw_payload || {};
        const metaErr = raw.error || {};
        console.log(`\n[${i + 1}] ${r.receiver_id} - ${r.sent_at}`);
        console.log(`  Erro: ${r.error_message}`);
        console.log(`  MetaCode: ${metaErr.code} | MetaSubCode: ${metaErr.error_subcode}`);
        console.log(`  Message: ${metaErr.message}`);
        console.log(`  ErrorData: ${JSON.stringify(metaErr.error_data)}`);
    });

    await db.end();
}

run().catch(e => console.error('ERRO:', e.message));
