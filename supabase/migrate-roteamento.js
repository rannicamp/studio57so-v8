// =============================================================
//  Fase 3: Automação de Roteamento de Leads
//  Cria:
//   → Tabela: regras_roteamento_funil
//   → Função: fn_rotear_lead(p_contato_no_funil_id)
//  Uso: node supabase/migrate-roteamento.js
// =============================================================

const { Client } = require('pg');
const STUDIO_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function run() {
    const db = new Client({ connectionString: decodeURIComponent(STUDIO_URL), ssl: SSL });
    await db.connect();
    console.log('✅ Conectado ao Studio 57\n');

    try {
        // 1. Cria a tabela de regras de roteamento
        await db.query(`
            CREATE TABLE IF NOT EXISTS regras_roteamento_funil (
                id                BIGSERIAL PRIMARY KEY,
                organizacao_id    BIGINT      NOT NULL,
                nome              TEXT        NOT NULL DEFAULT 'Regra sem nome',
                -- Filtros de origem (qualquer combinação)
                campaign_id       TEXT,        -- meta_campaign_id
                ad_id             TEXT,        -- meta_ad_id
                page_id           TEXT,        -- meta_page_id
                -- Destino (sem FK explícita para evitar conflito de tipo)
                funil_destino_id  BIGINT      NOT NULL,
                ativo             BOOLEAN     NOT NULL DEFAULT TRUE,
                ordem             INT         NOT NULL DEFAULT 0,
                created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        console.log('✅ Tabela regras_roteamento_funil criada (ou já existia)');

        // 2. Índice para buscas rápidas por org
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_regras_roteamento_org
            ON regras_roteamento_funil(organizacao_id, ativo, ordem);
        `);
        console.log('✅ Index criado');

        // 3. Cria a função de roteamento
        await db.query(`
            CREATE OR REPLACE FUNCTION fn_rotear_lead(p_contato_no_funil_id BIGINT)
            RETURNS TEXT LANGUAGE plpgsql AS $$
            DECLARE
                v_org_id         BIGINT;
                v_campaign_id    TEXT;
                v_ad_id          TEXT;
                v_page_id        TEXT;
                v_contato_id     BIGINT;
                v_funil_id       BIGINT;
                v_coluna_id      BIGINT;
                v_regra_nome     TEXT;
            BEGIN
                -- Busca dados do lead e do contato associado
                SELECT
                    cnf.organizacao_id,
                    c.meta_campaign_id,
                    c.meta_ad_id,
                    c.meta_page_id,
                    cnf.contato_id
                INTO v_org_id, v_campaign_id, v_ad_id, v_page_id, v_contato_id
                FROM contatos_no_funil cnf
                JOIN contatos c ON c.id = cnf.contato_id
                WHERE cnf.id = p_contato_no_funil_id;

                IF NOT FOUND THEN
                    RETURN 'ERRO: contato_no_funil não encontrado';
                END IF;

                -- Busca a primeira regra ativa que "bate" com este lead
                -- Ordem de prioridade: maior especificidade primeiro (ad_id > campaign_id > page_id)
                SELECT r.funil_destino_id, r.nome
                INTO v_funil_id, v_regra_nome
                FROM regras_roteamento_funil r
                WHERE r.organizacao_id = v_org_id
                  AND r.ativo = TRUE
                  AND (r.campaign_id IS NULL OR r.campaign_id = v_campaign_id)
                  AND (r.ad_id       IS NULL OR r.ad_id       = v_ad_id)
                  AND (r.page_id     IS NULL OR r.page_id     = v_page_id)
                ORDER BY
                    -- Mais específico = maior pontuação = mais prioridade
                    (CASE WHEN r.ad_id       IS NOT NULL THEN 4 ELSE 0 END +
                     CASE WHEN r.campaign_id IS NOT NULL THEN 2 ELSE 0 END +
                     CASE WHEN r.page_id     IS NOT NULL THEN 1 ELSE 0 END) DESC,
                    r.ordem ASC
                LIMIT 1;

                -- Sem regra → permanece no Funil de Entrada (não faz nada)
                IF v_funil_id IS NULL THEN
                    RETURN 'SEM_REGRA';
                END IF;

                -- Busca a coluna ENTRADA do funil destino
                SELECT id INTO v_coluna_id
                FROM colunas_funil
                WHERE funil_id = v_funil_id
                  AND tipo_coluna = 'entrada'
                LIMIT 1;

                IF v_coluna_id IS NULL THEN
                    RETURN 'ERRO: funil destino sem coluna ENTRADA';
                END IF;

                -- Move o lead para o funil destino
                UPDATE contatos_no_funil
                SET coluna_id = v_coluna_id
                WHERE id = p_contato_no_funil_id;

                RETURN 'ROTEADO:' || v_regra_nome;
            END;
            $$;
        `);
        console.log('✅ Função fn_rotear_lead criada');

        // 4. RLS: somente a própria organização vê/edita suas regras
        await db.query(`
            ALTER TABLE regras_roteamento_funil ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS "org_acesso_propria_regra" ON regras_roteamento_funil;
            CREATE POLICY "org_acesso_propria_regra"
            ON regras_roteamento_funil
            USING (
                organizacao_id IN (
                    SELECT organizacao_id FROM usuarios WHERE id = auth.uid()
                )
            );
        `);
        console.log('✅ RLS configurado na tabela regras_roteamento_funil');

        console.log('\n🎉 Migração da Fase 3 concluída!');
        console.log('   Tabela regras_roteamento_funil + fn_rotear_lead prontos.');

    } catch (e) {
        console.error('💥 ERRO:', e.message);
    } finally {
        await db.end();
    }
}

run();
