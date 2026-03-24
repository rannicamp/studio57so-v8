require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

async function run() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const dbUrl = `postgres://postgres:${password}@${host}:6543/postgres`;

  if (!dbUrl || !password) {
    console.log('Database URL not found.');
    return;
  }

  const sql = postgres(dbUrl, { ssl: 'require' });

  try {
    console.log('Iniciando atualização da trigger de faturas...');
    
    await sql`
CREATE OR REPLACE FUNCTION public.fn_vincular_lancamento_fatura()
RETURNS trigger AS $function$
DECLARE
    v_conta_id bigint;
    v_tipo_conta text;
    v_dia_fechamento integer;
    v_dia_pagamento integer;
    v_mes_referencia text;
    v_data_vencimento date;
    v_fatura_id bigint;
    v_data_base date;
BEGIN
    -- Se for um UPDATE onde as datas e contas cruciais não mudaram, não recalcula a fatura!
    IF TG_OP = 'UPDATE' THEN
        IF NEW.data_transacao = OLD.data_transacao 
           AND NEW.data_vencimento = OLD.data_vencimento 
           AND NEW.conta_id IS NOT DISTINCT FROM OLD.conta_id 
           AND NEW.tipo = OLD.tipo THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Determinar a conta_id (financeiro_lancamentos possui apenas conta_id principal)
    IF NEW.tipo IN ('Despesa', 'Receita') THEN
        v_conta_id := NEW.conta_id;

        IF v_conta_id IS NOT NULL THEN
            -- Buscar informações da conta
            SELECT tipo, dia_fechamento_fatura, dia_pagamento_fatura 
            INTO v_tipo_conta, v_dia_fechamento, v_dia_pagamento
            FROM public.contas_financeiras 
            WHERE id = v_conta_id;

            IF v_tipo_conta = 'Cartão de Crédito' THEN
                
                -- Se não houver dia fechamento ou pagamento configurado, ignorar
                IF v_dia_fechamento IS NULL OR v_dia_pagamento IS NULL THEN
                    RETURN NEW;
                END IF;

                -- NOVA LÓGICA: Se NEW.data_vencimento já possui o dia correto de pagamento,
                 -- assumimos que o frontend (ou parcelamento ou conciliação) já definiu a fatura correta!
                IF NEW.data_vencimento IS NOT NULL AND EXTRACT(DAY FROM NEW.data_vencimento) = v_dia_pagamento THEN
                    v_data_vencimento := NEW.data_vencimento;
                    
                    IF v_dia_pagamento <= v_dia_fechamento THEN
                        v_mes_referencia := to_char(v_data_vencimento - INTERVAL '1 month', 'YYYY-MM');
                    ELSE
                        v_mes_referencia := to_char(v_data_vencimento, 'YYYY-MM');
                    END IF;
                ELSE
                    v_data_base := NEW.data_transacao;

                    IF EXTRACT(DAY FROM v_data_base) >= v_dia_fechamento THEN
                        v_data_base := v_data_base + INTERVAL '1 month';
                    END IF;

                    v_mes_referencia := to_char(v_data_base, 'YYYY-MM');

                    IF v_dia_pagamento <= v_dia_fechamento THEN
                       v_data_vencimento := (to_char(v_data_base + INTERVAL '1 month', 'YYYY-MM-') || LPAD(v_dia_pagamento::text, 2, '0'))::date;
                    ELSE
                       v_data_vencimento := (v_mes_referencia || '-' || LPAD(v_dia_pagamento::text, 2, '0'))::date;
                    END IF;
                    
                    NEW.data_vencimento := v_data_vencimento;
                END IF;

                -- BUSCAR OU CRIAR A FATURA
                SELECT id INTO v_fatura_id 
                FROM public.faturas_cartao 
                WHERE conta_id = v_conta_id AND mes_referencia = v_mes_referencia;

                IF v_fatura_id IS NULL THEN
                    -- Se não existe, cria a fatura e já retorna o ID
                    INSERT INTO public.faturas_cartao (conta_id, mes_referencia, data_vencimento, organizacao_id)
                    VALUES (v_conta_id, v_mes_referencia, v_data_vencimento, NEW.organizacao_id)
                    RETURNING id INTO v_fatura_id;
                END IF;

                -- Amarrar o lançamento à fatura
                NEW.fatura_id := v_fatura_id;
            ELSE
                -- Se não é cartão de crédito, garantir que fatura_id seja nulo
                NEW.fatura_id := NULL;
            END IF;
        END IF;

    END IF;

    RETURN NEW;
END;
$function$ LANGUAGE plpgsql;
    `;
    
    console.log('Sucesso! Função fn_vincular_lancamento_fatura atualizada com as novas proteções de ancoragem e reconhecimento de parcelamento.');
  } catch (error) {
    console.error('Erro ao atualizar a trigger:', error);
  } finally {
    await sql.end();
  }
}

run();
