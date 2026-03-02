// =============================================================
//  Fase 1: Funil de Entrada Padrão
//  - Adiciona coluna is_sistema na tabela funis
//  - Renomeia "Funil de Vendas" → "Funil de Entrada" (Org 2)
//  - Marca como is_sistema = true
//  ⚠️  Apenas banco Dev (Studio 57)
//  Uso: node supabase/migrate-funil-entrada.js
// =============================================================

const { Client } = require('pg');
const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const db = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await db.connect();
    console.log('✅ Conectado ao Studio 57\n');

    try {
        // 1. Adiciona coluna is_sistema (ignora se já existir)
        await db.query(`
            ALTER TABLE funis
            ADD COLUMN IF NOT EXISTS is_sistema BOOLEAN DEFAULT FALSE;
        `);
        console.log('✅ Coluna is_sistema garantida na tabela funis');

        // 2. Renomeia e protege o funil principal de cada organização existente
        // Estratégia: o funil mais antigo (menor id) de cada org é o "Funil de Entrada"
        const { rows: orgs } = await db.query(`
            SELECT DISTINCT organizacao_id FROM funis ORDER BY organizacao_id
        `);

        for (const { organizacao_id } of orgs) {
            // Pega o funil mais antigo da org
            const { rows: funilAntigo } = await db.query(`
                SELECT id, nome FROM funis
                WHERE organizacao_id = $1
                ORDER BY id ASC
                LIMIT 1
            `, [organizacao_id]);

            if (funilAntigo.length > 0) {
                const funil = funilAntigo[0];
                await db.query(`
                    UPDATE funis
                    SET nome = 'Funil de Entrada', is_sistema = true
                    WHERE id = $1
                `, [funil.id]);
                console.log(`✅ Org ${organizacao_id}: Funil "${funil.nome}" → "Funil de Entrada" (is_sistema=true, id=${funil.id})`);
            }
        }

        // 3. Garante que todos os outros funis de cada org têm is_sistema = false
        await db.query(`
            UPDATE funis SET is_sistema = FALSE
            WHERE is_sistema IS NULL OR is_sistema = FALSE
        `);
        console.log('✅ Demais funis marcados como is_sistema=false');

        console.log('\n🎉 Migração da Fase 1 concluída!');
        console.log('   O "Funil de Entrada" agora é o funil inviolável por organização.');
    } catch (e) {
        console.error('💥 ERRO:', e.message);
    } finally {
        await db.end();
    }
}

run();
