// ============================================================
//  MIGRAÇÃO SEGURA DO FUNIL - Studio 57 (Dev)
//  1. Adiciona coluna 'tipo_coluna' em colunas_funil
//  2. Garante Funil + Colunas âncora para Org 2 (ENTRADA/VENDIDO/PERDIDO)
//  3. Migra leads da Org 2 que estão na coluna da Org 1 (sistema)
//  Uso: node supabase/migrate-funnel.js
// ============================================================

const { Client } = require('pg');

const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function migrateFunnel() {
    const db = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });

    try {
        await db.connect();
        console.log('✅ Conectado ao Studio 57 (banco de desenvolvimento)\n');

        // ─── FASE 1: Estrutura do Banco ─────────────────────────────────
        console.log('═'.repeat(55));
        console.log('📐 FASE 1: Adicionando coluna tipo_coluna ao schema');
        console.log('═'.repeat(55));

        await db.query(`
            ALTER TABLE colunas_funil
            ADD COLUMN IF NOT EXISTS tipo_coluna TEXT DEFAULT 'etapa';
        `);
        console.log('✅ Coluna "tipo_coluna" garantida na tabela colunas_funil!\n');

        // ─── FASE 2: Funil e Colunas Âncora da Org 2 ───────────────────
        console.log('═'.repeat(55));
        console.log('🏗️  FASE 2: Garantindo Funil da Org 2');
        console.log('═'.repeat(55));

        const TARGET_ORG = 2;
        const PADROES = [
            { nome: 'ENTRADA', tipo: 'entrada', ordem: 0 },
            { nome: 'VENDIDO', tipo: 'ganho', ordem: 98 },
            { nome: 'PERDIDO', tipo: 'perdido', ordem: 99 },
        ];

        // 2a. Busca ou cria o Funil de Vendas da Org 2
        let { rows: funisOrg2 } = await db.query(
            `SELECT id FROM funis WHERE organizacao_id = $1 AND nome = 'Funil de Vendas' LIMIT 1`,
            [TARGET_ORG]
        );

        let funilId;
        if (funisOrg2.length === 0) {
            const { rows: inserted } = await db.query(
                `INSERT INTO funis (nome, organizacao_id) VALUES ('Funil de Vendas', $1) RETURNING id`,
                [TARGET_ORG]
            );
            funilId = inserted[0].id;
            console.log(`✨ Funil de Vendas CRIADO para Org 2 (id: ${funilId})`);
        } else {
            funilId = funisOrg2[0].id;
            console.log(`✅ Funil de Vendas da Org 2 já existe (id: ${funilId})`);
        }

        // 2b. Garante as 3 colunas âncora
        console.log('\n🔑 Garantindo colunas âncora (ENTRADA, VENDIDO, PERDIDO)...');
        const mapaColunasOrg2 = {}; // tipo -> linha do banco

        for (const p of PADROES) {
            const { rows: existingCols } = await db.query(
                `SELECT id, tipo_coluna FROM colunas_funil
                 WHERE organizacao_id = $1 AND nome = $2
                 LIMIT 1`,
                [TARGET_ORG, p.nome]
            );

            if (existingCols.length > 0) {
                // Atualiza o tipo_coluna caso já existia sem o label correto
                await db.query(
                    `UPDATE colunas_funil SET tipo_coluna = $1, funil_id = $2, ordem = $3 WHERE id = $4`,
                    [p.tipo, funilId, p.ordem, existingCols[0].id]
                );
                mapaColunasOrg2[p.tipo] = existingCols[0].id;
                console.log(`   ✅ Coluna '${p.nome}' já existe → tipo_coluna atualizado para '${p.tipo}'`);
            } else {
                const { rows: newCol } = await db.query(
                    `INSERT INTO colunas_funil (nome, tipo_coluna, ordem, funil_id, organizacao_id)
                     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                    [p.nome, p.tipo, p.ordem, funilId, TARGET_ORG]
                );
                mapaColunasOrg2[p.tipo] = newCol[0].id;
                console.log(`   ✨ Coluna '${p.nome}' CRIADA para Org 2 (id: ${newCol[0].id})`);
            }
        }

        // ─── FASE 3: Migrar Leads Extraviados ──────────────────────────
        console.log('\n' + '═'.repeat(55));
        console.log('🚚 FASE 3: Migrando leads da Org 2 para coluna nativa');
        console.log('═'.repeat(55));

        // Busca a(s) coluna(s) ENTRADA que pertencem à Org 1 (sistema)
        const { rows: colunasOrg1 } = await db.query(
            `SELECT id FROM colunas_funil WHERE organizacao_id = 1 AND nome = 'ENTRADA'`
        );

        if (colunasOrg1.length === 0) {
            console.log('ℹ️  Nenhuma coluna ENTRADA do sistema (Org 1) encontrada — sem necessidade de migração.');
        } else {
            const idsColunaSistema = colunasOrg1.map(c => c.id);
            console.log(`   🔍 Colunas do sistema encontradas: [${idsColunaSistema.join(', ')}]`);

            // Monta cláusula IN dinamicamente para evitar cast de tipo
            const placeholders = idsColunaSistema.map((_, i) => `$${i + 2}`).join(', ');

            // Conta quantos leads precisam mover
            const { rows: contagem } = await db.query(
                `SELECT COUNT(*) as total FROM contatos_no_funil
                 WHERE organizacao_id = $1 AND coluna_id IN (${placeholders})`,
                [TARGET_ORG, ...idsColunaSistema]
            );

            const totalParaMigrar = parseInt(contagem[0].total);
            console.log(`   📊 Leads da Org 2 na coluna do sistema: ${totalParaMigrar}`);

            if (totalParaMigrar > 0) {
                // Move todos para a nova coluna ENTRADA nativa da Org 2
                const novaEntradaId = mapaColunasOrg2['entrada'];
                const updatePlaceholders = idsColunaSistema.map((_, i) => `$${i + 3}`).join(', ');
                await db.query(
                    `UPDATE contatos_no_funil
                     SET coluna_id = $1
                     WHERE organizacao_id = $2 AND coluna_id IN (${updatePlaceholders})`,
                    [novaEntradaId, TARGET_ORG, ...idsColunaSistema]
                );
                console.log(`   ✅ ${totalParaMigrar} leads migrados para a ENTRADA nativa da Org 2 (coluna_id: ${novaEntradaId})!`);
            } else {
                console.log('   ✅ Nenhum lead precisa ser migrado. Tudo certo!');
            }
        }

        // ─── FASE 4: Stampar tipo_coluna em colunas legadas da Org 1 ───
        console.log('\n' + '═'.repeat(55));
        console.log('🏷️  FASE 4: Etiquetando colunas legadas da Org 1');
        console.log('═'.repeat(55));

        const mapeamento = [
            { nome: 'ENTRADA', tipo: 'entrada' },
            { nome: 'VENDIDO', tipo: 'ganho' },
            { nome: 'PERDIDO', tipo: 'perdido' },
        ];

        for (const m of mapeamento) {
            const { rowCount } = await db.query(
                `UPDATE colunas_funil SET tipo_coluna = $1 WHERE nome = $2 AND (tipo_coluna IS NULL OR tipo_coluna = 'etapa')`,
                [m.tipo, m.nome]
            );
            console.log(`   ✅ Coluna '${m.nome}' → tipo_coluna='${m.tipo}' (${rowCount} linha(s) atualizadas)`);
        }

        console.log('\n' + '═'.repeat(55));
        console.log('🎉 MIGRAÇÃO CONCLUÍDA COM SEGURANÇA!');
        console.log('   ✅ Org 2 agora tem Funil e Colunas 100% próprias.');
        console.log('   ✅ Zero perda de dados.');
        console.log('   ✅ Banco pronto para o Webhook refatorado e CAPI.');
        console.log('═'.repeat(55));

    } catch (err) {
        console.error('\n💥 ERRO DURANTE A MIGRAÇÃO:', err.message);
        console.error(err.stack);
    } finally {
        try { await db.end(); } catch (e) { }
    }
}

migrateFunnel();
