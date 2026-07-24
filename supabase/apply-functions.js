// Busca as funções do LAB e aplica no PROD
// Uso: node supabase/apply-functions.js

const { Client } = require('pg');

const LAB_URL = 'postgresql://postgres:REMOVED_PASSWORD@db.alqzomckjnefsmhusnfu.supabase.co:5432/postgres';
const PROD_URL = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;
const SSL = { rejectUnauthorized: false };

const FUNCOES_ALVO = ['auto_confirm_user', 'registrar_retirada_estoque'];

async function main() {
    const lab = new Client({ connectionString: decodeURIComponent(LAB_URL), ssl: SSL });
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    await lab.connect();
    await prod.connect();
    console.log('✅ Conectado ao LAB e PROD\n');

    for (const nomeFuncao of FUNCOES_ALVO) {
        const { rows } = await lab.query(`
      SELECT pg_get_functiondef(oid) AS def
      FROM pg_proc
      WHERE proname = $1 AND pronamespace = 'public'::regnamespace
      LIMIT 1
    `, [nomeFuncao]);

        if (rows.length === 0) {
            console.log(`⚠️  Função "${nomeFuncao}" não encontrada no LAB`);
            continue;
        }

        const def = rows[0].def;
        try {
            await prod.query(def);
            console.log(`✅ Função "${nomeFuncao}" aplicada no PROD!`);
        } catch (err) {
            console.error(`❌ Erro ao aplicar "${nomeFuncao}": ${err.message}`);
        }
    }

    await lab.end();
    await prod.end();
    console.log('\n✅ Concluído!');
}

main().catch(err => console.error('❌', err.message));
