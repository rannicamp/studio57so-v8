// =========================================================
//  Studio 57 — Migração: Suporte a Ativos e Passivos
//  Uso: node supabase/migrate-ativos-passivos.mjs
// =========================================================
import pg from 'pg';
const { Client } = pg;

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';

const client = new Client({
    connectionString: decodeURIComponent(PROD_URL),
    ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log('✅ Conectado ao banco!\n');

// -------------------------------------------------------
// FASE 1: Adicionar 'Conta de Ativo' e 'Conta de Passivo'
//         nos tipos permitidos em contas_financeiras
// -------------------------------------------------------
console.log('⏳ Fase 1: Atualizando tipos de contas_financeiras...');
try {
    await client.query(`ALTER TABLE public.contas_financeiras DROP CONSTRAINT IF EXISTS contas_financeiras_tipo_check;`);
    await client.query(`
        ALTER TABLE public.contas_financeiras
        ADD CONSTRAINT contas_financeiras_tipo_check
        CHECK (tipo IN (
            'Conta Corrente', 'Poupança', 'Cartão de Crédito',
            'Caixa', 'Carteira',
            'Conta Investimento', 'Dinheiro',
            'Passivos',
            'Conta de Ativo',
            'Conta de Passivo'
        ));
    `);
    console.log('   ✅ Tipos de contas_financeiras atualizados!');
} catch (e) {
    console.error('   ❌ Erro ao atualizar contas_financeiras:', e.message);
}

// -------------------------------------------------------
// FASE 2: Adicionar 'Ativo' e 'Passivo' nos tipos
//         permitidos em lancamentos
// -------------------------------------------------------
console.log('\n⏳ Fase 2: Atualizando tipos de lancamentos...');
try {
    await client.query(`ALTER TABLE public.lancamentos DROP CONSTRAINT IF EXISTS lancamentos_tipo_check;`);
    await client.query(`
        ALTER TABLE public.lancamentos
        ADD CONSTRAINT lancamentos_tipo_check
        CHECK (tipo IN ('Receita', 'Despesa', 'Transferência', 'Ativo', 'Passivo'));
    `);
    console.log('   ✅ Tipos de lancamentos atualizados!');
} catch (e) {
    console.error('   ❌ Erro ao atualizar lancamentos:', e.message);
}

// -------------------------------------------------------
// FASE 3: Adicionar coluna contrato_id em lancamentos
//         (opcional, para vincular permutas a contratos)
// -------------------------------------------------------
console.log('\n⏳ Fase 3: Adicionando coluna contrato_id em lancamentos...');
try {
    await client.query(`
        ALTER TABLE public.lancamentos
        ADD COLUMN IF NOT EXISTS contrato_id bigint REFERENCES public.contratos(id) ON DELETE SET NULL;
    `);
    console.log('   ✅ Coluna contrato_id adicionada!');
} catch (e) {
    console.error('   ❌ Erro ao adicionar contrato_id:', e.message);
}

// -------------------------------------------------------
// FASE 4: Atualizar trigger de fatura para ignorar
//         lançamentos do tipo Ativo/Passivo
// -------------------------------------------------------
console.log('\n⏳ Fase 4: Atualizando trigger fn_vincular_lancamento_fatura...');
try {
    await client.query(`
        CREATE OR REPLACE FUNCTION public.fn_vincular_lancamento_fatura()
        RETURNS trigger AS $$
        DECLARE
            v_conta_id bigint;
            v_tipo_conta text;
            v_dia_fechamento integer;
            v_dia_pagamento integer;
            v_mes_referencia text;
            v_data_vencimento date;
            v_fatura_id bigint;
            v_data_comp date;
        BEGIN
            -- Ignorar completamente lançamentos patrimoniais (Ativo/Passivo)
            IF NEW.tipo IN ('Ativo', 'Passivo') THEN
                RETURN NEW;
            END IF;

            v_conta_id := NEW.conta_id;
            IF v_conta_id IS NULL THEN RETURN NEW; END IF;

            -- Verificar se é Cartão de Crédito
            SELECT tipo, dia_fechamento_fatura, dia_pagamento_fatura
            INTO v_tipo_conta, v_dia_fechamento, v_dia_pagamento
            FROM public.contas_financeiras WHERE id = v_conta_id;

            IF v_tipo_conta IS DISTINCT FROM 'Cartão de Crédito' THEN
                NEW.fatura_id := NULL;
                RETURN NEW;
            END IF;

            IF v_dia_fechamento IS NULL OR v_dia_pagamento IS NULL THEN
                RETURN NEW;
            END IF;

            v_data_comp := NEW.data_transacao;
            IF v_data_comp IS NULL THEN RETURN NEW; END IF;

            IF EXTRACT(DAY FROM v_data_comp) >= v_dia_fechamento THEN
                v_data_comp := v_data_comp + INTERVAL '1 month';
            END IF;
            v_mes_referencia := to_char(v_data_comp, 'YYYY-MM');

            IF v_dia_pagamento <= v_dia_fechamento THEN
                v_data_vencimento := (to_char(v_data_comp + INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
            ELSE
                v_data_vencimento := (v_mes_referencia || '-' || LPAD(v_dia_pagamento::text, 2, '0'))::date;
            END IF;

            NEW.data_vencimento := v_data_vencimento;

            SELECT id INTO v_fatura_id FROM public.faturas_cartao
            WHERE conta_id = v_conta_id AND mes_referencia = v_mes_referencia;

            IF v_fatura_id IS NULL THEN
                INSERT INTO public.faturas_cartao (conta_id, mes_referencia, data_vencimento, organizacao_id)
                VALUES (v_conta_id, v_mes_referencia, v_data_vencimento, NEW.organizacao_id)
                RETURNING id INTO v_fatura_id;
            END IF;

            NEW.fatura_id := v_fatura_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log('   ✅ Trigger fn_vincular_lancamento_fatura atualizada!');
} catch (e) {
    console.error('   ❌ Erro ao atualizar trigger:', e.message);
}

// -------------------------------------------------------
// VERIFICAÇÃO FINAL
// -------------------------------------------------------
console.log('\n📊 Verificando o estado atual do banco...');
const verificacao = await client.query(`
    SELECT 
        (SELECT count(*) FROM public.contas_financeiras WHERE tipo IN ('Conta de Ativo', 'Conta de Passivo')) AS contas_patrimonio,
        (SELECT count(*) FROM public.lancamentos WHERE tipo IN ('Ativo', 'Passivo')) AS lancamentos_patrimonio,
        (SELECT count(*) FROM public.contrato_permutas) AS permutas_legado
`);
console.table(verificacao.rows);

await client.end();
console.log('\n🔌 Migração concluída!');
