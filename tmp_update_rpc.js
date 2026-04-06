require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

async function updateRPC() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `aws-0-sa-east-1.pooler.supabase.com`;
  const connStr = `postgres://postgres.${projectId}:${password}@${host}:5432/postgres`;

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    
    const query = `
CREATE OR REPLACE FUNCTION public.unificar_materiais(old_material_id bigint, new_material_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- ===================================================
  -- 1. TRATAMENTO DA TABELA ESTOQUE (A Parte Matemática)
  -- ===================================================

  -- PASSO A: Atualizar o destino (novo) somando as quantidades da origem (velho)
  UPDATE public.estoque AS dest
  SET 
    quantidade_atual = dest.quantidade_atual + src.quantidade_atual,
    quantidade_em_uso = dest.quantidade_em_uso + src.quantidade_em_uso,
    custo_medio = CASE 
        WHEN (dest.quantidade_atual + src.quantidade_atual) > 0 THEN
            ((dest.quantidade_atual * dest.custo_medio) + (src.quantidade_atual * src.custo_medio)) / (dest.quantidade_atual + src.quantidade_atual)
        ELSE dest.custo_medio 
    END,
    ultima_atualizacao = NOW()
  FROM public.estoque AS src
  WHERE dest.material_id = new_material_id
    AND src.material_id = old_material_id
    AND dest.empreendimento_id = src.empreendimento_id;

  -- PASSO B: Apagar os registros antigos que acabaram de ser somados no passo acima
  DELETE FROM public.estoque
  WHERE material_id = old_material_id
    AND empreendimento_id IN (
        SELECT empreendimento_id 
        FROM public.estoque 
        WHERE material_id = new_material_id
    );

  -- PASSO C: Renomear o restante
  UPDATE public.estoque
  SET material_id = new_material_id
  WHERE material_id = old_material_id;


  -- ===================================================
  -- 2. TRATAMENTO DA TABELA ESTOQUE_OBRA (Mesma lógica)
  -- ===================================================
  
  -- PASSO A: Soma onde já existe
  UPDATE public.estoque_obra AS dest
  SET 
    quantidade = dest.quantidade + src.quantidade,
    ultima_atualizacao = NOW()
  FROM public.estoque_obra AS src
  WHERE dest.material_id = new_material_id
    AND src.material_id = old_material_id
    AND dest.empreendimento_id = src.empreendimento_id;

  -- PASSO B: Apaga os somados
  DELETE FROM public.estoque_obra
  WHERE material_id = old_material_id
    AND empreendimento_id IN (
        SELECT empreendimento_id 
        FROM public.estoque_obra 
        WHERE material_id = new_material_id
    );

  -- PASSO C: Renomeia o restante
  UPDATE public.estoque_obra
  SET material_id = new_material_id
  WHERE material_id = old_material_id;

  -- ===================================================
  -- 3. TRATAMENTO DA TABELA ORCAMENTO_ITENS
  -- ===================================================

  -- Soma onde já existe o material_id no mesmo orcamento_id
  UPDATE public.orcamento_itens AS dest
  SET 
    quantidade = dest.quantidade + src.quantidade,
    custo_total = dest.custo_total + src.custo_total
  FROM public.orcamento_itens AS src
  WHERE dest.material_id = new_material_id
    AND src.material_id = old_material_id
    AND dest.orcamento_id = src.orcamento_id;

  -- Deleta os orcamento_itens do material velho que já possuíam contraparte no novo material
  DELETE FROM public.orcamento_itens
  WHERE material_id = old_material_id
    AND orcamento_id IN (
        SELECT orcamento_id 
        FROM public.orcamento_itens 
        WHERE material_id = new_material_id
    );

  -- Renomeia o restante para os orçamentos que nao possuíam o novo material
  UPDATE public.orcamento_itens
  SET material_id = new_material_id
  WHERE material_id = old_material_id;


  -- ===================================================
  -- 4. TRATAMENTO DA TABELA PEDIDOS_COMPRA_ITENS
  -- ===================================================

  -- Soma as quantidades e custos se os itens estiverem lado a lado no memo pedido_compra_id
  UPDATE public.pedidos_compra_itens AS dest
  SET 
    quantidade_solicitada = dest.quantidade_solicitada + src.quantidade_solicitada,
    custo_total_real = COALESCE(dest.custo_total_real, 0) + COALESCE(src.custo_total_real, 0)
  FROM public.pedidos_compra_itens AS src
  WHERE dest.material_id = new_material_id
    AND src.material_id = old_material_id
    AND dest.pedido_compra_id = src.pedido_compra_id;

  -- Delete items do material velho num pedido_compra_id que já abrigava o material novo
  DELETE FROM public.pedidos_compra_itens
  WHERE material_id = old_material_id
    AND pedido_compra_id IN (
        SELECT pedido_compra_id 
        FROM public.pedidos_compra_itens 
        WHERE material_id = new_material_id
    );

  -- Para os pedidos de compra orfãos, reatribuir ID
  UPDATE public.pedidos_compra_itens
  SET material_id = new_material_id
  WHERE material_id = old_material_id;


  -- ===================================================
  -- 5. MOVIMENTACOES DE ESTOQUE E FAXINA FINAL
  -- ===================================================
  
  -- Apagar o material antigo da tabela de cadastro
  DELETE FROM public.materiais
  WHERE id = old_material_id;

END;
$function$;
    `;
    
    await client.query(query);
    console.log("RPC unificar_materiais successfully updated!");

  } catch(e) {
    console.error("Error setting RPC:", e.message);
  } finally {
    await client.end();
  }
}
updateRPC();
