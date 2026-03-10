// =============================================================
//  MIGRAÇÃO COMPLETA: Studio 57 → Elo 57
//  Exporta TODAS as funções e políticas RLS do Studio 57
//  e aplica sequencialmente no Elo 57 (produção).
//
//  Uso: node supabase/migrar-studio-elo.js
// =============================================================

const { Client } = require('pg');
const fs = require('fs');

const PASS = 'Srbr19010720%40';
const STUDIO_URL = `postgresql://postgres:${PASS}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;
const ELO_URL = `postgresql://postgres:${PASS}@db.alqzomckjnefsmhusnfu.supabase.co:5432/postgres`;
const SSL = { rejectUnauthorized: false };
const MIGRATION_FILE = 'supabase/migrations/20260309_full_sync.sql';

async function getClient(url, nome) {
    const c = new Client({ connectionString: decodeURIComponent(url), ssl: SSL });
    await c.connect();
    console.log(`✅ Conectado: ${nome}`);
    return c;
}

async function main() {
    const studio = await getClient(STUDIO_URL, 'Studio 57 (origem)');
    const elo = await getClient(ELO_URL, 'Elo 57    (destino)');

    let sqlOut = [];
    let ok = 0, erros = 0;

    // ── 1. FUNÇÕES / RPCs ──────────────────────────────────────
    console.log('\n⚡ Sincronizando Funções/RPCs...');
    const { rows: funcs } = await studio.query(`
        SELECT p.proname, pg_get_functiondef(p.oid) AS def
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
        WHERE n.nspname = 'public' AND p.prokind = 'f' AND d.objid IS NULL
    `);

    for (const f of funcs) {
        try {
            await elo.query(f.def);
            sqlOut.push(f.def + ';\n');
            console.log(`   ✅ Função: ${f.proname}`);
            ok++;
        } catch (e) {
            console.error(`   ❌ Função "${f.proname}": ${e.message}`);
            sqlOut.push(`-- ERRO FUNÇÃO ${f.proname}: ${e.message}\n-- ${f.def}\n`);
            erros++;
        }
    }

    // ── 2. HABILITAR RLS NAS TABELAS ──────────────────────────
    console.log('\n🔒 Habilitando RLS nas tabelas...');
    const { rows: tables } = await studio.query(`
        SELECT tablename, rowsecurity 
        FROM pg_tables WHERE schemaname = 'public'
    `);

    for (const t of tables) {
        if (t.rowsecurity) {
            const sql = `ALTER TABLE public."${t.tablename}" ENABLE ROW LEVEL SECURITY;`;
            try {
                await elo.query(sql);
                sqlOut.push(sql + '\n');
                ok++;
            } catch (e) {
                console.error(`   ❌ RLS enable "${t.tablename}": ${e.message}`);
                erros++;
            }
        }
    }

    // ── 3. POLÍTICAS RLS ──────────────────────────────────────
    console.log('\n🔐 Replicando Políticas RLS...');
    const { rows: policies } = await studio.query(`
        SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies WHERE schemaname = 'public'
    `);

    for (const p of policies) {
        const dropSql = `DROP POLICY IF EXISTS "${p.policyname}" ON public."${p.tablename}";`;
        let createSql = `CREATE POLICY "${p.policyname}" ON public."${p.tablename}"`;
        if (p.permissive === 'PERMISSIVE') createSql += ' AS PERMISSIVE';
        if (p.cmd) createSql += ` FOR ${p.cmd}`;

        // normaliza roles
        let roles = p.roles;
        if (typeof roles === 'string') roles = roles.replace(/[{}]/g, '');
        if (roles && roles !== 'public') createSql += ` TO ${roles}`;
        if (p.qual) createSql += `\n  USING (${p.qual})`;
        if (p.with_check) createSql += `\n  WITH CHECK (${p.with_check})`;
        createSql += ';';

        try {
            await elo.query(dropSql);
            await elo.query(createSql);
            sqlOut.push(dropSql + '\n' + createSql + '\n');
            ok++;
        } catch (e) {
            console.error(`   ❌ Policy "${p.policyname}" em "${p.tablename}": ${e.message}`);
            sqlOut.push(`-- ERRO POLICY: ${e.message}\n-- ${createSql}\n`);
            erros++;
        }
    }

    // ── 4. COLUNAS FALTANTES ──────────────────────────────────
    console.log('\n📦 Sincronizando colunas novas...');
    const { rows: studioTabs } = await studio.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const { rows: eloTabs } = await elo.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const eloTabSet = new Set(eloTabs.map(r => r.table_name));

    for (const tRow of studioTabs) {
        const tbl = tRow.table_name;
        if (!eloTabSet.has(tbl)) {
            // Tabela inteira faltando - cria esqueleto mínimo
            const { rows: cols } = await studio.query(`
                SELECT column_name, data_type, character_maximum_length,
                       is_nullable, column_default, udt_name
                FROM information_schema.columns
                WHERE table_schema='public' AND table_name=$1
                ORDER BY ordinal_position
            `, [tbl]);

            const colDefs = cols.map(c => {
                let tipo = c.udt_name === 'uuid' ? 'uuid'
                    : c.data_type === 'character varying' ? `varchar(${c.character_maximum_length || 255})`
                        : c.data_type === 'USER-DEFINED' ? c.udt_name
                            : c.data_type;
                let def = `  ${c.column_name} ${tipo}`;
                if (c.is_nullable === 'NO') def += ' NOT NULL';
                if (c.column_default) def += ` DEFAULT ${c.column_default}`;
                return def;
            }).join(',\n');

            const createTbl = `CREATE TABLE IF NOT EXISTS public.${tbl} (\n${colDefs}\n);`;
            try {
                await elo.query(createTbl);
                sqlOut.push(createTbl + '\n');
                console.log(`   ✅ CREATE TABLE ${tbl}`);
                ok++;
            } catch (e) {
                console.error(`   ❌ CREATE TABLE ${tbl}: ${e.message}`);
                erros++;
            }
            continue;
        }

        // Tabela existe — checar colunas novas
        const { rows: studioCols } = await studio.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable, column_default, udt_name
            FROM information_schema.columns WHERE table_schema='public' AND table_name=$1
        `, [tbl]);
        const { rows: eloCols } = await elo.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema='public' AND table_name=$1
        `, [tbl]);
        const eloColSet = new Set(eloCols.map(c => c.column_name));

        for (const col of studioCols) {
            if (!eloColSet.has(col.column_name)) {
                let tipo = col.udt_name === 'uuid' ? 'uuid'
                    : col.data_type === 'character varying' ? `varchar(${col.character_maximum_length || 255})`
                        : col.data_type === 'USER-DEFINED' ? col.udt_name
                            : col.data_type;
                let sql = `ALTER TABLE public.${tbl} ADD COLUMN IF NOT EXISTS ${col.column_name} ${tipo}`;
                if (col.is_nullable === 'NO') sql += ' NOT NULL';
                if (col.column_default) sql += ` DEFAULT ${col.column_default}`;
                sql += ';';
                try {
                    await elo.query(sql);
                    sqlOut.push(sql + '\n');
                    console.log(`   ✅ ${tbl}.${col.column_name} adicionado`);
                    ok++;
                } catch (e) {
                    console.error(`   ❌ ADD COLUMN ${tbl}.${col.column_name}: ${e.message}`);
                    erros++;
                }
            }
        }
    }

    // ── SALVAR MIGRATION FILE ─────────────────────────────────
    const header = `-- ======================================================\n-- MIGRAÇÃO COMPLETA: Studio 57 → Elo 57\n-- Gerada em: ${new Date().toISOString()}\n-- ✅ OK: ${ok} | ❌ Erros: ${erros}\n-- ======================================================\n\n`;
    fs.writeFileSync(MIGRATION_FILE, header + sqlOut.join('\n'), 'utf8');

    console.log('\n' + '='.repeat(55));
    console.log(`🏁 MIGRAÇÃO CONCLUÍDA!`);
    console.log(`✅ Aplicados com sucesso: ${ok}`);
    console.log(`❌ Erros (ver log acima): ${erros}`);
    console.log(`📄 Migration salva: ${MIGRATION_FILE}`);
    console.log('='.repeat(55));

    await studio.end();
    await elo.end();
}

main().catch(err => {
    console.error('❌ Erro Fatal:', err.message);
    process.exit(1);
});
