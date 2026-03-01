// Verificação rápida do estado do Elo 57 após sincronização
// node supabase/check-elo.js
const { Client } = require('pg');
const ELO_URL = 'postgresql://postgres:Srbr19010720%40@db.alqzomckjnefsmhusnfu.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function check() {
    const c = new Client({ connectionString: decodeURIComponent(ELO_URL), ssl: SSL });
    await c.connect();
    console.log('=== VERIFICAÇÃO DO ELO 57 ===\n');

    const { rows: tabelas } = await c.query(
        "SELECT COUNT(*) as total FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
    );
    console.log('Total tabelas no Elo 57:', tabelas[0].total);

    const { rows: authUser } = await c.query(
        "SELECT id, email, created_at FROM auth.users WHERE email = 'rannierecampos1@hotmail.com' LIMIT 1"
    );
    if (authUser.length > 0) {
        console.log('\n[AUTH] Usuario encontrado:', authUser[0].email, '| UUID:', authUser[0].id);
    } else {
        console.log('\n[AUTH] Usuario rannierecampos1@hotmail.com NAO encontrado em auth.users do Elo 57');
    }

    const { rows: pubUser } = await c.query(
        "SELECT id, email, is_superadmin, organizacao_id FROM public.usuarios WHERE email = 'rannierecampos1@hotmail.com' LIMIT 1"
    );
    if (pubUser.length > 0) {
        console.log('[TABELA] Usuario na public.usuarios:', JSON.stringify(pubUser[0]));
    } else {
        console.log('[TABELA] Usuario NAO encontrado em public.usuarios');
    }

    const { rows: funcoes } = await c.query(
        "SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_type='FUNCTION' ORDER BY routine_name"
    );
    console.log('\nFuncoes no Elo 57 (' + funcoes.length + '):', funcoes.map(f => f.routine_name).join(', '));

    await c.end();
}
check().catch(e => console.error('ERRO:', e.message));
