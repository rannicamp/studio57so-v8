const { Client } = require('pg');
const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const db = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await db.connect();
    console.log('Conectado ao Studio 57');

    try {
        // 1. Altera coluna funil_destino_id de BIGINT para TEXT (para suportar UUID)
        await db.query(`
            ALTER TABLE regras_roteamento_funil
            ALTER COLUMN funil_destino_id TYPE TEXT USING funil_destino_id::TEXT;
        `);
        console.log('OK: funil_destino_id agora e TEXT (suporta UUID)');

        // 2. Recria fn_rotear_lead usando TEXT para funil_destino_id
        await db.query(`
            CREATE OR REPLACE FUNCTION fn_rotear_lead(p_contato_no_funil_id BIGINT)
            RETURNS TEXT LANGUAGE plpgsql AS $func$
            DECLARE
                v_org_id      BIGINT;
                v_campaign_id TEXT;
                v_ad_id       TEXT;
                v_page_id     TEXT;
                v_funil_id    TEXT;
                v_coluna_id   BIGINT;
                v_regra_nome  TEXT;
            BEGIN
                SELECT cnf.organizacao_id, c.meta_campaign_id, c.meta_ad_id, c.meta_page_id
                INTO v_org_id, v_campaign_id, v_ad_id, v_page_id
                FROM contatos_no_funil cnf
                JOIN contatos c ON c.id = cnf.contato_id
                WHERE cnf.id = p_contato_no_funil_id;

                IF NOT FOUND THEN
                    RETURN 'ERRO: contato_no_funil nao encontrado';
                END IF;

                SELECT r.funil_destino_id, r.nome
                INTO v_funil_id, v_regra_nome
                FROM regras_roteamento_funil r
                WHERE r.organizacao_id = v_org_id
                  AND r.ativo = TRUE
                  AND (r.campaign_id IS NULL OR r.campaign_id = v_campaign_id)
                  AND (r.ad_id IS NULL OR r.ad_id = v_ad_id)
                  AND (r.page_id IS NULL OR r.page_id = v_page_id)
                ORDER BY
                    (CASE WHEN r.ad_id IS NOT NULL THEN 4 ELSE 0 END +
                     CASE WHEN r.campaign_id IS NOT NULL THEN 2 ELSE 0 END +
                     CASE WHEN r.page_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
                    r.ordem ASC
                LIMIT 1;

                IF v_funil_id IS NULL THEN
                    RETURN 'SEM_REGRA';
                END IF;

                -- Busca coluna ENTRADA do funil destino (cast funil_id para text para comparar)
                SELECT id INTO v_coluna_id
                FROM colunas_funil
                WHERE funil_id::TEXT = v_funil_id
                  AND tipo_coluna = 'entrada'
                LIMIT 1;

                IF v_coluna_id IS NULL THEN
                    RETURN 'ERRO: funil destino sem coluna ENTRADA';
                END IF;

                UPDATE contatos_no_funil
                SET coluna_id = v_coluna_id
                WHERE id = p_contato_no_funil_id;

                RETURN 'ROTEADO:' || v_regra_nome;
            END;
            $func$;
        `);
        console.log('OK: fn_rotear_lead atualizada para usar TEXT como funil_id');

        console.log('\nMigracao concluida!');
    } catch (e) {
        console.error('ERRO:', e.message);
    } finally {
        await db.end();
    }
}

run();
