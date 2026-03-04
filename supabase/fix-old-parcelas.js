// Script para corrigir "Retroativamente" a data_vencimento de parcelas antigas.
// Como elas tinham sido sobrescritas com a data de compra pela trigger antiga,
// vamos usar o parcela_grupo para ordenar as parcelas (1/x, 2/x)
// e adicionar +1 mês a cada parcela subsequente usando SQL nativo.

const { Client } = require('pg');
const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function main() {
    const db = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    await db.connect();
    console.log('✅ Conectado ao banco de dados!\n');

    console.log('⏳ Analisando parcelamentos atuais no cartão...');

    // Consulta para mostrar o problema antes do fix
    const antes = await db.query(`
        SELECT l.id, l.descricao, l.parcela_grupo, l.data_vencimento, f.mes_referencia
        FROM public.lancamentos l
        JOIN public.contas_financeiras c ON c.id = l.conta_id
        LEFT JOIN public.faturas_cartao f ON f.id = l.fatura_id
        WHERE l.parcela_grupo IS NOT NULL AND c.tipo = 'Cartão de Crédito'
        ORDER BY l.parcela_grupo, l.id ASC
        LIMIT 10;
    `);
    console.log('📊 Como estão as primeiras parcelas (ANTES):');
    console.table(antes.rows);

    console.log('\n⏳ Corrigindo data_vencimento de todas as parcelas (isso acionará a trigger corrigida para arrumar as faturas)...');

    // O pulo do gato: usamos ROW_NUMBER para saber qual é o índice da parcela (0, 1, 2...)
    // E FIRST_VALUE para pegar a data de vencimento da primeira parcela do grupo.
    // Assim, a parcela 2 ganha +1 mês, a parcela 3 ganha +2 meses, etc.
    const updateResult = await db.query(`
        WITH numbered_parcelas AS (
            SELECT 
                l.id,
                l.parcela_grupo,
                ROW_NUMBER() OVER (PARTITION BY l.parcela_grupo ORDER BY l.id ASC) - 1 AS parcel_index,
                FIRST_VALUE(l.data_vencimento) OVER (PARTITION BY l.parcela_grupo ORDER BY l.id ASC) AS base_vencimento
            FROM public.lancamentos l
            JOIN public.contas_financeiras c ON c.id = l.conta_id
            WHERE l.parcela_grupo IS NOT NULL
              AND c.tipo = 'Cartão de Crédito'
        ),
        updated_dates AS (
            SELECT 
                id,
                (base_vencimento + (parcel_index || ' month')::interval)::date AS new_vencimento
            FROM numbered_parcelas
            WHERE parcel_index > 0
        )
        UPDATE public.lancamentos temp
        SET data_vencimento = u.new_vencimento
        FROM updated_dates u
        WHERE temp.id = u.id AND temp.data_vencimento <> u.new_vencimento
        RETURNING temp.id;
    `);

    console.log(`✅ Sucesso! ${updateResult.rowCount} parcelas tiveram suas datas de vencimento corrigidas e re-distribuídas.`);

    // Mostrar como ficou
    const depois = await db.query(`
        SELECT l.id, l.descricao, l.parcela_grupo, l.data_vencimento, f.mes_referencia
        FROM public.lancamentos l
        JOIN public.contas_financeiras c ON c.id = l.conta_id
        LEFT JOIN public.faturas_cartao f ON f.id = l.fatura_id
        WHERE l.parcela_grupo IS NOT NULL AND c.tipo = 'Cartão de Crédito'
        ORDER BY l.parcela_grupo, l.id ASC
        LIMIT 10;
    `);
    console.log('\n📊 Como ficaram as primeiras parcelas (DEPOIS):');
    console.table(depois.rows);

    await db.end();
}

main().catch(err => console.error('❌ ERRO FATAL:', err.message));
