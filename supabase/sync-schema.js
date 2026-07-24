// =============================================================
//  Studio 57 — Sincronizador de Schema LAB → PROD
//  Uso: node supabase/sync-schema.js
// =============================================================
//  Requer: npm install pg
//  Compara as tabelas/colunas do LAB com o PROD e gera
//  um arquivo SQL com as diferenças para aplicar no PROD.
// =============================================================

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// --- CONFIGURAÇÃO ---
const LAB_URL = 'postgresql://postgres:REMOVED_PASSWORD@db.alqzomckjnefsmhusnfu.supabase.co:5432/postgres';
const PROD_URL = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`;

// Schemas a comparar
const SCHEMAS = ['public'];

// Arquivo de saída com o SQL gerado
const OUTPUT_FILE = path.join(__dirname, 'sync_output.sql');

// =============================================================

const SSL_CONFIG = { rejectUnauthorized: false };

async function connectDB(url, nome) {
    const client = new Client({ connectionString: decodeURIComponent(url), ssl: SSL_CONFIG });
    await client.connect();
    console.log(`✅ Conectado ao ${nome}`);
    return client;
}

// Busca todas as tabelas de um schema
async function getTables(client, schema) {
    const { rows } = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = $1 AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [schema]);
    return rows.map(r => r.table_name);
}

// Busca colunas de uma tabela
async function getColumns(client, schema, table) {
    const { rows } = await client.query(`
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      is_nullable,
      column_default,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position
  `, [schema, table]);
    return rows;
}

// Busca os índices de uma tabela
async function getIndexes(client, schema, table) {
    const { rows } = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = $1 AND tablename = $2
    ORDER BY indexname
  `, [schema, table]);
    return rows;
}

// Busca as funções/RPCs
async function getFunctions(client, schema) {
    const { rows } = await client.query(`
    SELECT routine_name, routine_definition
    FROM information_schema.routines
    WHERE routine_schema = $1 AND routine_type = 'FUNCTION'
    ORDER BY routine_name
  `, [schema]);
    return rows;
}

function colKey(col) {
    return `${col.data_type}|${col.character_maximum_length}|${col.is_nullable}|${col.column_default}|${col.udt_name}`;
}

async function main() {
    let lab, prod;
    const lines = [];
    const log = (msg) => { console.log(msg); lines.push('-- ' + msg); };

    lines.push('-- ================================================');
    lines.push('-- SYNC SCRIPT: LAB → PROD');
    lines.push(`-- Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    lines.push('-- ⚠️  REVISE ANTES DE EXECUTAR NO PROD!');
    lines.push('-- ================================================\n');

    try {
        lab = await connectDB(LAB_URL, 'LAB  (alqzomckjnefsmhusnfu)');
        prod = await connectDB(PROD_URL, 'PROD (vhuvnutzklhskkwbpxdz)');
    } catch (err) {
        console.error('❌ Erro de conexão:', err.message);
        process.exit(1);
    }

    let totalDiffs = 0;

    for (const schema of SCHEMAS) {
        log(`\n📦 Comparando schema: ${schema}`);
        lines.push('');

        const labTables = await getTables(lab, schema);
        const prodTables = await getTables(prod, schema);
        const prodSet = new Set(prodTables);
        const labSet = new Set(labTables);

        // 1. TABELAS QUE EXISTEM NO LAB MAS NÃO NO PROD
        const tabelasNovas = labTables.filter(t => !prodSet.has(t));
        if (tabelasNovas.length > 0) {
            log(`\n🆕 Tabelas para CRIAR no PROD (${tabelasNovas.length}):`);
            for (const table of tabelasNovas) {
                totalDiffs++;
                const cols = await getColumns(lab, schema, table);
                lines.push(`\n-- CRIAR TABELA: ${table}`);
                lines.push(`CREATE TABLE IF NOT EXISTS ${schema}.${table} (`);
                const colDefs = cols.map(c => {
                    let tipo = c.udt_name === 'uuid' ? 'uuid' :
                        c.data_type === 'character varying' ? `varchar(${c.character_maximum_length || 255})` :
                            c.data_type === 'USER-DEFINED' ? c.udt_name : c.data_type;
                    let def = `  ${c.column_name} ${tipo}`;
                    if (c.is_nullable === 'NO') def += ' NOT NULL';
                    if (c.column_default) def += ` DEFAULT ${c.column_default}`;
                    return def;
                });
                lines.push(colDefs.join(',\n'));
                lines.push(');');
                console.log(`   ➕ CREATE TABLE ${table}`);
            }
        }

        // 2. TABELAS QUE EXISTEM NO PROD MAS NÃO NO LAB (cuidado!)
        const tabelasRemovidasDoLab = prodTables.filter(t => !labSet.has(t));
        if (tabelasRemovidasDoLab.length > 0) {
            log(`\n⚠️  Tabelas no PROD que NÃO EXISTEM no LAB (${tabelasRemovidasDoLab.length}) — NÃO SERÃO DROPADAS automaticamente:`);
            lines.push('\n-- ⚠️  AS TABELAS ABAIXO EXISTEM NO PROD MAS NÃO NO LAB');
            lines.push('-- DESCOMENTE COM CUIDADO APENAS SE TIVER CERTEZA:');
            for (const table of tabelasRemovidasDoLab) {
                lines.push(`-- DROP TABLE IF EXISTS ${schema}.${table};`);
                console.log(`   ⚠️  ${table} existe no PROD mas não no LAB`);
            }
        }

        // 3. TABELAS QUE EXISTEM NOS DOIS — COMPARAR COLUNAS
        const tabelasComuns = labTables.filter(t => prodSet.has(t));
        log(`\n🔍 Comparando colunas de ${tabelasComuns.length} tabelas em comum...`);

        for (const table of tabelasComuns) {
            const labCols = await getColumns(lab, schema, table);
            const prodCols = await getColumns(prod, schema, table);

            const prodColMap = {};
            prodCols.forEach(c => prodColMap[c.column_name] = c);

            const labColMap = {};
            labCols.forEach(c => labColMap[c.column_name] = c);

            // Colunas novas (no LAB mas não no PROD)
            const colsNovas = labCols.filter(c => !prodColMap[c.column_name]);
            // Colunas diferentes (tipo/nullable/default mudou)
            const colsAlteradas = labCols.filter(c => {
                const p = prodColMap[c.column_name];
                return p && colKey(c) !== colKey(p);
            });

            if (colsNovas.length > 0 || colsAlteradas.length > 0) {
                totalDiffs++;
                lines.push(`\n-- ALTERAÇÕES NA TABELA: ${table}`);
                console.log(`   📝 ${table} tem diferenças:`);

                for (const col of colsNovas) {
                    let tipo = col.udt_name === 'uuid' ? 'uuid' :
                        col.data_type === 'character varying' ? `varchar(${col.character_maximum_length || 255})` :
                            col.data_type === 'USER-DEFINED' ? col.udt_name : col.data_type;
                    let def = `ALTER TABLE ${schema}.${table} ADD COLUMN IF NOT EXISTS ${col.column_name} ${tipo}`;
                    if (col.is_nullable === 'NO') def += ' NOT NULL';
                    if (col.column_default) def += ` DEFAULT ${col.column_default}`;
                    lines.push(def + ';');
                    console.log(`      ➕ ADD COLUMN ${col.column_name} (${tipo})`);
                }

                for (const col of colsAlteradas) {
                    const prod_col = prodColMap[col.column_name];
                    let tipo = col.udt_name === 'uuid' ? 'uuid' :
                        col.data_type === 'character varying' ? `varchar(${col.character_maximum_length || 255})` :
                            col.data_type === 'USER-DEFINED' ? col.udt_name : col.data_type;
                    lines.push(`-- ⚠️  COLUNA ALTERADA: ${col.column_name}`);
                    lines.push(`-- LAB:  ${colKey(col)}`);
                    lines.push(`-- PROD: ${colKey(prod_col)}`);
                    lines.push(`ALTER TABLE ${schema}.${table} ALTER COLUMN ${col.column_name} TYPE ${tipo} USING ${col.column_name}::${tipo};`);
                    console.log(`      🔄 COLUNA ALTERADA: ${col.column_name}`);
                }
            }
        }

        // 4. COMPARAR FUNÇÕES
        log('\n⚡ Comparando funções/RPCs...');
        const labFuncs = await getFunctions(lab, schema);
        const prodFuncs = await getFunctions(prod, schema);
        const prodFuncSet = new Set(prodFuncs.map(f => f.routine_name));
        const funcsNovas = labFuncs.filter(f => !prodFuncSet.has(f.routine_name));

        if (funcsNovas.length > 0) {
            totalDiffs++;
            lines.push(`\n-- FUNÇÕES/RPCs NO LAB QUE NÃO EXISTEM NO PROD (${funcsNovas.length}):`);
            lines.push('-- ⚠️  Copie as funções do SQL Editor do Supabase LAB e aplique no PROD');
            funcsNovas.forEach(f => {
                lines.push(`-- FUNÇÃO FALTANDO: ${f.routine_name}`);
                console.log(`   ➕ FUNÇÃO: ${f.routine_name}`);
            });
        }
    }

    // RESULTADO FINAL
    lines.push('\n-- ================================================');
    lines.push(`-- FIM DO SCRIPT | Total de diferenças: ${totalDiffs}`);
    lines.push('-- ================================================');

    fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8');

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Script gerado: supabase/sync_output.sql`);
    console.log(`📊 Total de diferenças encontradas: ${totalDiffs}`);
    console.log('');
    console.log('PRÓXIMOS PASSOS:');
    console.log('1. Abra o arquivo:  supabase/sync_output.sql');
    console.log('2. Revise cada ALTER TABLE e CREATE TABLE');
    console.log('3. No Supabase PROD → SQL Editor → cole e execute');
    console.log('='.repeat(50));

    await lab.end();
    await prod.end();
}

main().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
