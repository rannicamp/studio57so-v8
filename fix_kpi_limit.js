const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  const query = `
CREATE OR REPLACE FUNCTION get_conversation_response_kpis(p_conversation_record_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_retorno jsonb;
    v_broker_sum_minutes numeric := 0;
    v_broker_count int := 0;
    v_lead_sum_minutes numeric := 0;
    v_lead_count int := 0;
    
    v_prev_dir text := NULL;
    v_prev_msg_time timestamptz := NULL;
    v_diff numeric;
    
    rec record;
BEGIN
    FOR rec IN 
        SELECT direction, created_at 
        FROM whatsapp_messages 
        WHERE conversation_record_id = p_conversation_record_id
          AND direction IN ('inbound', 'outbound')
        ORDER BY created_at ASC
    LOOP
        IF v_prev_dir IS NOT NULL AND v_prev_dir != rec.direction THEN
            v_diff := EXTRACT(EPOCH FROM (rec.created_at - v_prev_msg_time))/60;
            
            -- Ignoramos hiatos maiores que 7 dias (10080 minutos) pois configuram reativação/novo contato
            IF v_diff <= 10080 THEN
                -- Mudança de inbound para outbound (Corretor respondeu)
                IF v_prev_dir = 'inbound' AND rec.direction = 'outbound' THEN
                    v_broker_sum_minutes := v_broker_sum_minutes + v_diff;
                    v_broker_count := v_broker_count + 1;
                END IF;
                
                -- Mudança de outbound para inbound (Lead respondeu)
                IF v_prev_dir = 'outbound' AND rec.direction = 'inbound' THEN
                    v_lead_sum_minutes := v_lead_sum_minutes + v_diff;
                    v_lead_count := v_lead_count + 1;
                END IF;
            END IF;
        END IF;

        v_prev_dir := rec.direction;
        v_prev_msg_time := rec.created_at;
    END LOOP;

    v_retorno := jsonb_build_object(
        'broker_avg_minutes', CASE WHEN v_broker_count > 0 THEN ROUND((v_broker_sum_minutes / v_broker_count)::numeric, 2) ELSE 0 END,
        'lead_avg_minutes', CASE WHEN v_lead_count > 0 THEN ROUND((v_lead_sum_minutes / v_lead_count)::numeric, 2) ELSE 0 END,
        'broker_count', v_broker_count,
        'lead_count', v_lead_count
    );

    RETURN v_retorno;
END;
$$;
  `;

  try {
      await client.query(query);
      console.log('RPC get_conversation_response_kpis atualizada com sucesso com limite de 7 dias!');
  } catch(e) {
      console.error('Erro:', e);
  }

  await client.end();
}

main();
