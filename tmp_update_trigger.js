const { Client } = require('pg');

const PROD_URL = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres';
const SSL = { rejectUnauthorized: false };

async function main() {
    const prod = new Client({ connectionString: decodeURIComponent(PROD_URL), ssl: SSL });
    await prod.connect();
    console.log('✅ Conectado ao PROD');

    const sql = `
CREATE OR REPLACE FUNCTION public.handle_pedido_entregue_estoque()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    item_pedido RECORD;
    v_estoque_id bigint;
    v_usuario_id uuid;
    v_classificacao text;
BEGIN
    IF NEW.status = 'Entregue' AND OLD.status IS DISTINCT FROM 'Entregue' THEN
        BEGIN
            v_usuario_id := auth.uid();
        EXCEPTION WHEN OTHERS THEN
            v_usuario_id := NULL;
        END;

        FOR item_pedido IN
            SELECT *
            FROM public.pedidos_compra_itens pci
            WHERE pci.pedido_compra_id = NEW.id
        LOOP
            IF item_pedido.material_id IS NOT NULL AND item_pedido.quantidade_solicitada IS NOT NULL AND item_pedido.quantidade_solicitada > 0 THEN
               
                SELECT classificacao INTO v_classificacao
                FROM public.materiais
                WHERE id = item_pedido.material_id;

                IF v_classificacao = 'Serviço' THEN
                    CONTINUE;
                END IF;

                INSERT INTO public.estoque (
                    empreendimento_id, material_id, quantidade_atual, unidade_medida, organizacao_id, ultima_atualizacao
                )
                VALUES (
                    NEW.empreendimento_id, item_pedido.material_id, item_pedido.quantidade_solicitada, item_pedido.unidade_medida, NEW.organizacao_id, now()
                )
                ON CONFLICT (empreendimento_id, material_id)
                DO UPDATE SET
                    quantidade_atual = public.estoque.quantidade_atual + EXCLUDED.quantidade_atual,
                    ultima_atualizacao = now()
                RETURNING id INTO v_estoque_id;

                INSERT INTO public.movimentacoes_estoque (
                    estoque_id, tipo, quantidade, pedido_compra_id, usuario_id, observacao, organizacao_id
                )
                VALUES (
                    v_estoque_id, 'Entrada por Compra', item_pedido.quantidade_solicitada, NEW.id, v_usuario_id,
                    'Entrada automática via Pedido #' || NEW.id || ' (' || item_pedido.descricao_item || ')', NEW.organizacao_id
                );
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$function$;
    `;

    try {
        await prod.query(sql);
        console.log('✅ Função "handle_pedido_entregue_estoque" atualizada com sucesso no banco!');
    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await prod.end();
    }
}

main();
