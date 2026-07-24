// =============================================================
//  Studio 57 — Aplica as alterações seguras no banco PROD
//  Uso: node supabase/apply-to-prod.js
// =============================================================

const { Client } = require('pg');

const PROD_URL = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;

// SQL seguro para aplicar — apenas ADD COLUMN IF NOT EXISTS
// (nunca apaga dados, nunca altera dados existentes)
const SQL_COMMANDS = [
    {
        descricao: 'integracoes_meta: ADD COLUMN nome_conta',
        sql: `ALTER TABLE public.integracoes_meta ADD COLUMN IF NOT EXISTS nome_conta text;`
    },
    {
        descricao: 'integracoes_meta: ADD COLUMN meta_user_id',
        sql: `ALTER TABLE public.integracoes_meta ADD COLUMN IF NOT EXISTS meta_user_id text;`
    },
    {
        descricao: "integracoes_meta: ADD COLUMN status DEFAULT 'inativo'",
        sql: `ALTER TABLE public.integracoes_meta ADD COLUMN IF NOT EXISTS status text DEFAULT 'inativo'::text;`
    },
    {
        descricao: 'integracoes_meta: ADD COLUMN page_access_token',
        sql: `ALTER TABLE public.integracoes_meta ADD COLUMN IF NOT EXISTS page_access_token text;`
    },
    {
        descricao: 'lancamentos: ADD COLUMN antecipacao_grupo_id',
        sql: `ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS antecipacao_grupo_id uuid;`
    },
];

async function main() {
    const client = new Client({
        connectionString: decodeURIComponent(PROD_URL),
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao PROD\n');

        let ok = 0;
        let erros = 0;

        for (const cmd of SQL_COMMANDS) {
            try {
                await client.query(cmd.sql);
                console.log(`✅ OK: ${cmd.descricao}`);
                ok++;
            } catch (err) {
                console.error(`❌ ERRO em "${cmd.descricao}": ${err.message}`);
                erros++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`✅ Aplicadas com sucesso: ${ok}`);
        console.log(`❌ Erros: ${erros}`);
        console.log('='.repeat(50));

    } catch (err) {
        console.error('❌ Erro de conexão:', err.message);
    } finally {
        await client.end();
    }
}

main();
