// =============================================================
//  Studio 57 → Elo 57 — Sincronização de Schema + Funções
//  ORIGEM: vhuvnutzklhskkwbpxdz (Studio 57 - Desenvolvimento)
//  DESTINO: alqzomckjnefsmhusnfu (Elo 57   - Produção Clientes)
//
//  ⚠️  Apenas SCHEMA e FUNÇÕES são sincronizados — NUNCA dados!
//  Uso: node supabase/sync-final.js
// =============================================================

const { Client } = require('pg');

const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const ELO_URL = 'postgresql://postgres:Srbr19010720%40@db.alqzomckjnefsmhusnfu.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

// Email do super admin a ser inserido NO ELO 57
const SUPER_ADMIN_EMAIL = 'rannierecampos1@hotmail.com';

// ─── Helpers ──────────────────────────────────────────────────
async function getColumns(client, schema, table) {
    const { rows } = await client.query(`
        SELECT column_name, data_type, character_maximum_length,
               is_nullable, column_default, udt_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
    `, [schema, table]);
    return rows;
}

function colKey(col) {
    return `${col.data_type}|${col.character_maximum_length}|${col.is_nullable}|${col.udt_name}`;
}

function tipoSQL(col) {
    if (col.udt_name === 'uuid') return 'uuid';
    if (col.data_type === 'character varying') return `varchar(${col.character_maximum_length || 255})`;
    if (col.data_type === 'USER-DEFINED') return col.udt_name;
    return col.data_type;
}

async function main() {
    const studio = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    const elo = new Client({ connectionString: decodeURIComponent(ELO_URL), ssl: SSL });

    try {
        await studio.connect();
        await elo.connect();
        console.log('✅ Conectado ao Studio 57 (origem)');
        console.log('✅ Conectado ao Elo 57    (destino)\n');

        let totalOk = 0, totalErros = 0;

        // ─── ETAPA 1: Sincronizar Tabelas e Colunas ───────────────────────
        console.log('━'.repeat(55));
        console.log('📦 ETAPA 1: Sincronizando tabelas e colunas');
        console.log('    (Studio 57 → Elo 57 | sem copiar dados)');
        console.log('━'.repeat(55));

        const { rows: studioTablesRaw } = await studio.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        const { rows: eloTablesRaw } = await elo.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        const studioTables = studioTablesRaw.map(r => r.table_name);
        const eloTablesSet = new Set(eloTablesRaw.map(r => r.table_name));

        // 1a. Tabelas novas (no Studio mas não no Elo)
        const tabelasNovas = studioTables.filter(t => !eloTablesSet.has(t));
        if (tabelasNovas.length > 0) {
            console.log(`\n🆕 Tabelas para CRIAR no Elo 57 (${tabelasNovas.length}):`);
            for (const table of tabelasNovas) {
                const cols = await getColumns(studio, 'public', table);
                const colDefs = cols.map(c => {
                    let def = `  ${c.column_name} ${tipoSQL(c)}`;
                    if (c.is_nullable === 'NO') def += ' NOT NULL';
                    if (c.column_default) def += ` DEFAULT ${c.column_default}`;
                    return def;
                });
                const createSQL = `CREATE TABLE IF NOT EXISTS public.${table} (\n${colDefs.join(',\n')}\n);`;
                try {
                    await elo.query(createSQL);
                    console.log(`   ✅ CREATE TABLE ${table}`);
                    totalOk++;
                } catch (err) {
                    console.error(`   ❌ Erro em CREATE TABLE ${table}: ${err.message}`);
                    totalErros++;
                }
            }
        }

        // 1b. Colunas novas em tabelas existentes
        const tabelasComuns = studioTables.filter(t => eloTablesSet.has(t));
        console.log(`\n🔍 Comparando colunas de ${tabelasComuns.length} tabelas em comum...`);

        for (const table of tabelasComuns) {
            const studioCols = await getColumns(studio, 'public', table);
            const eloCols = await getColumns(elo, 'public', table);
            const eloColMap = {};
            eloCols.forEach(c => eloColMap[c.column_name] = c);

            const colsNovas = studioCols.filter(c => !eloColMap[c.column_name]);
            const colsAlteradas = studioCols.filter(c => eloColMap[c.column_name] && colKey(c) !== colKey(eloColMap[c.column_name]));

            if (colsNovas.length > 0 || colsAlteradas.length > 0) {
                console.log(`\n   📝 Tabela "${table}":`);
            }

            for (const col of colsNovas) {
                let def = `ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS ${col.column_name} ${tipoSQL(col)}`;
                if (col.is_nullable === 'NO') def += ' NOT NULL';
                if (col.column_default) def += ` DEFAULT ${col.column_default}`;
                try {
                    await elo.query(def + ';');
                    console.log(`      ✅ ADD COLUMN ${col.column_name}`);
                    totalOk++;
                } catch (err) {
                    console.error(`      ❌ Erro ADD COLUMN ${col.column_name}: ${err.message}`);
                    totalErros++;
                }
            }

            for (const col of colsAlteradas) {
                try {
                    await elo.query(`ALTER TABLE public.${table} ALTER COLUMN ${col.column_name} TYPE ${tipoSQL(col)} USING ${col.column_name}::${tipoSQL(col)};`);
                    console.log(`      ✅ ALTER COLUMN ${col.column_name} → ${tipoSQL(col)}`);
                    totalOk++;
                } catch (err) {
                    if (err.message.includes('cannot be cast')) {
                        console.log(`      ⚠️  Ignorado (tipo compatível): ${col.column_name}`);
                    } else {
                        console.error(`      ❌ Erro ALTER COLUMN ${col.column_name}: ${err.message}`);
                        totalErros++;
                    }
                }
            }
        }

        // ─── ETAPA 2: Sincronizar Funções/RPCs ────────────────────────────
        console.log('\n' + '━'.repeat(55));
        console.log('⚡ ETAPA 2: Sincronizando funções/RPCs + Triggers');
        console.log('    (Studio 57 → Elo 57)');
        console.log('━'.repeat(55));

        const { rows: studioFuncs } = await studio.query(`
            SELECT p.proname, pg_get_functiondef(p.oid) AS def
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
            WHERE n.nspname = 'public' AND p.prokind = 'f' AND d.objid IS NULL
        `);

        const { rows: eloFuncs } = await elo.query(`
            SELECT routine_name FROM information_schema.routines
            WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
        `);
        const eloFuncSet = new Set(eloFuncs.map(f => f.routine_name));

        let funcNovas = 0;
        for (const func of studioFuncs) {
            if (!eloFuncSet.has(func.proname)) {
                try {
                    await elo.query(func.def);
                    console.log(`   ✅ Função "${func.proname}" aplicada no Elo 57!`);
                    funcNovas++;
                    totalOk++;
                } catch (err) {
                    console.error(`   ❌ Erro na função "${func.proname}": ${err.message}`);
                    totalErros++;
                }
            }
        }
        if (funcNovas === 0) console.log('   ✅ Nenhuma função nova para sincronizar.');

        // ─── ETAPA 3: Super Admin no Elo 57 ───────────────────────────────
        console.log('\n' + '━'.repeat(55));
        console.log('👑 ETAPA 3: Configurando Super Admin no Elo 57');
        console.log('━'.repeat(55));

        // Busca o UUID no auth.users do Elo 57
        const { rows: eloAuthUser } = await elo.query(
            `SELECT id, email FROM auth.users WHERE email = $1 LIMIT 1`,
            [SUPER_ADMIN_EMAIL]
        );

        if (eloAuthUser.length === 0) {
            console.log(`\n   ⚠️  ATENÇÃO: O usuário "${SUPER_ADMIN_EMAIL}" NÃO existe no auth.users do Elo 57.`);
            console.log(`   👉 Você precisa criar este usuário no PAINEL do Supabase Elo 57:`);
            console.log(`      URL: https://supabase.com/dashboard/project/alqzomckjnefsmhusnfu`);
            console.log(`      → Authentication → Users → Invite User`);
            console.log(`      Depois rode este script novamente.\n`);

            // Tentar buscar no Studio para mostrar o UUID lá
            const { rows: studioAuthUser } = await studio.query(
                `SELECT id, email FROM auth.users WHERE email = $1 LIMIT 1`,
                [SUPER_ADMIN_EMAIL]
            );
            if (studioAuthUser.length > 0) {
                console.log(`   ℹ️  No Studio 57, o UUID deste usuário é: ${studioAuthUser[0].id}`);
                console.log(`   ℹ️  Mas UUIDs do Auth não são compartilhados entre projetos.\n`);
            }
        } else {
            const userId = eloAuthUser[0].id;
            console.log(`   ✅ Usuário encontrado no Elo 57 Auth! UUID: ${userId}`);

            const { rows: orgs } = await elo.query(`SELECT id FROM public.organizacoes ORDER BY id LIMIT 1`);
            const orgId = orgs.length > 0 ? orgs[0].id : 1;

            try {
                await elo.query(`
                    INSERT INTO public.usuarios (id, email, nome, sobrenome, is_active, is_superadmin, organizacao_id, created_at, updated_at)
                    VALUES ($1, $2, 'Ranniere', 'Campos', true, true, $3, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE
                        SET is_superadmin = true, is_active = true, updated_at = NOW()
                `, [userId, SUPER_ADMIN_EMAIL, orgId]);
                console.log(`   ✅ Super Admin inserido/atualizado na tabela public.usuarios do Elo 57!`);
                console.log(`   ✅ Organização associada: ID ${orgId}`);
            } catch (err) {
                console.error(`   ❌ Erro ao inserir Super Admin: ${err.message}`);
            }
        }

        // ─── RESULTADO FINAL ──────────────────────────────────────────────
        console.log('\n' + '═'.repeat(55));
        console.log('🏁 SINCRONIZAÇÃO CONCLUÍDA!');
        console.log('═'.repeat(55));
        console.log(`✅ Alterações aplicadas: ${totalOk}`);
        console.log(`❌ Erros:               ${totalErros}`);
        console.log(`🔁 Direção: Studio 57 → Elo 57`);
        console.log(`⚠️  Dados NÃO foram copiados (apenas schema/funções).`);
        console.log('═'.repeat(55));

    } catch (err) {
        console.error('❌ Erro geral:', err.message);
        console.error(err.stack);
    } finally {
        try { await studio.end(); } catch (e) { }
        try { await elo.end(); } catch (e) { }
    }
}

main();
