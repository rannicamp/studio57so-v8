const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function exportarBanco() {
    console.log('🔄 Iniciando exportação do banco de dados Studio 57...');

    const client = new Client({
        connectionString: decodeURIComponent(STUDIO_URL),
        ssl: SSL
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao banco de dados');

        const rootDir = path.join(__dirname, '..');

        // ─── 1. EXPORTANDO FUNÇÕES PARA JSON ───
        console.log('📦 Extraindo funções (RPC)...');
        const { rows: funcoes } = await client.query(`
            SELECT routine_name, routine_definition
            FROM information_schema.routines
            WHERE specific_schema = 'public' 
              AND routine_type = 'FUNCTION'
            ORDER BY routine_name;
        `);

        if (funcoes.length > 0) {
            const fObj = {};
            funcoes.forEach(f => {
                fObj[f.routine_name] = f.routine_definition;
            });
            fs.writeFileSync(path.join(rootDir, 'functions.json'), JSON.stringify(fObj, null, 2), 'utf-8');
            console.log(`✅ ${funcoes.length} funções exportadas para functions.json`);
        }

        // ─── 2. EXPORTANDO ESTRUTURA PARA SQL ───
        console.log('📦 Extraindo tabelas para dbelo57.sql...');
        const { rows: cols } = await client.query(`
            SELECT table_name, column_name, data_type, character_maximum_length, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
        `);

        if (cols.length > 0) {
            let sqlContent = '-- ESQUEMA DO BANCO DE DADOS (Studio 57)\n';
            sqlContent += '-- Este arquivo é um espelho SIMPLIFICADO gerado pelo script exportar-db.cjs\n\n';

            let currentTable = '';

            for (const col of cols) {
                if (col.table_name !== currentTable) {
                    if (currentTable !== '') {
                        sqlContent += ');\n\n';
                    }
                    currentTable = col.table_name;
                    sqlContent += `CREATE TABLE public.${currentTable} (\n`;
                }

                const nullable = col.is_nullable === 'YES' ? '' : ' NOT NULL';
                const def = col.column_default ? ` DEFAULT ${col.column_default}` : '';
                const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';

                sqlContent += `    ${col.column_name} ${col.data_type}${length}${nullable}${def},\n`;
            }
            if (currentTable !== '') {
                sqlContent += ');\n';
            }

            // Limpa vírgulas sobrando no final da tabela (antes do ); )
            sqlContent = sqlContent.replace(/,\n\);/g, '\n);');

            fs.writeFileSync(path.join(rootDir, 'dbelo57.sql'), sqlContent, 'utf-8');
            console.log(`✅ Tabelas exportadas com sucesso para dbelo57.sql`);
        }

        console.log('🎉 Exportação concluída!');

    } catch (e) {
        console.error('❌ Erro durante a exportação:', e.message);
    } finally {
        await client.end();
    }
}

exportarBanco();
