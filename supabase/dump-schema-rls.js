const { Client } = require('pg');
const fs = require('fs');

const PASS = encodeURIComponent('Srbr19010720@');
// Lendo do Studio 57 (Laboratório)
const ORIGEM_URL = `postgresql://postgres:${PASS}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;

async function dumpRLSAndFunctions() {
    const client = new Client({ connectionString: ORIGEM_URL, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();
        console.log('✅ Conectado ao banco de Origem (Studio 57) para dump estrutural...');

        let dumpSQL = `-- ================================================\n`;
        dumpSQL += `-- 🗄️ DUMP ESTRUTURAL (POLÍTICAS RLS E FUNÇÕES)\n`;
        dumpSQL += `-- Extraído via Script Nativo (Sem Docker)\n`;
        dumpSQL += `-- Data: ${new Date().toISOString()}\n`;
        dumpSQL += `-- ================================================\n\n`;

        // 1. Extrair todas as tabelas e habilitar RLS nelas
        const { rows: tables } = await client.query(`
            SELECT tablename, rowsecurity 
            FROM pg_tables 
            WHERE schemaname = 'public'
        `);

        dumpSQL += `-- 1. HABILITAR ROW LEVEL SECURITY\n`;
        tables.forEach(t => {
            if (t.rowsecurity) {
                dumpSQL += `ALTER TABLE public."${t.tablename}" ENABLE ROW LEVEL SECURITY;\n`;
            }
        });
        dumpSQL += `\n`;

        // 2. Extrair todas as políticas RLS exportadas
        console.log('🔍 Lendo Políticas de Segurança (RLS)...');
        const { rows: policies } = await client.query(`
            SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE schemaname = 'public'
        `);

        dumpSQL += `-- 2. POLÍTICAS RLS (ROW LEVEL SECURITY)\n`;
        policies.forEach(p => {
            // Drop policy se existir antes
            dumpSQL += `DROP POLICY IF EXISTS "${p.policyname}" ON public."${p.tablename}";\n`;

            // Reconstruindo a policy original
            let policyStmt = `CREATE POLICY "${p.policyname}" ON public."${p.tablename}"`;
            if (p.permissive === 'PERMISSIVE') policyStmt += ` AS PERMISSIVE`;
            if (p.cmd) policyStmt += ` FOR ${p.cmd}`;

            // Roles (vem como array de strings ex: {public} ou varchar)
            let rolesStr = p.roles;
            if (Array.isArray(p.roles)) {
                rolesStr = p.roles.join(', ');
            } else if (typeof p.roles === 'string' && p.roles.startsWith('{')) {
                rolesStr = p.roles.replace('{', '').replace('}', '');
            }
            if (rolesStr && rolesStr !== 'public') {
                policyStmt += ` TO ${rolesStr}`;
            }

            if (p.qual) policyStmt += `\n  USING (${p.qual})`;
            if (p.with_check) policyStmt += `\n  WITH CHECK (${p.with_check})`;

            policyStmt += `;\n\n`;
            dumpSQL += policyStmt;
        });

        // 3. Extrair Funções
        console.log('🔍 Lendo Funções (RPCs)...');
        const { rows: functions } = await client.query(`
            SELECT pg_get_functiondef(p.oid) as definition
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
            WHERE n.nspname = 'public'
              AND p.prokind = 'f'
              AND d.objid IS NULL
        `);

        dumpSQL += `-- 3. FUNÇÕES E ROTINAS (RPCs)\n`;
        functions.forEach(f => {
            dumpSQL += `${f.definition};\n\n`;
        });

        fs.writeFileSync('supabase/clone_exato_rls.sql', dumpSQL, 'utf8');
        console.log('✅ DUMP REALIZADO COM SUCESSO! Salvo em: supabase/clone_exato_rls.sql');

    } catch (err) {
        console.error('❌ ERRO:', err.message);
    } finally {
        await client.end();
    }
}

dumpRLSAndFunctions();
