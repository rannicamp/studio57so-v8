ALTER TABLE public.elementos_bim ADD COLUMN IF NOT EXISTS sync_session text;

CREATE OR REPLACE FUNCTION public.sync_bim_elements_chunk(
    p_organizacao_id bigint, 
    p_projeto_id bigint, 
    p_urn text, 
    p_sync_session text,
    p_elementos jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. UPSERT (Inserir novos ou Atualizar existentes no Lote)
  INSERT INTO public.elementos_bim (
    organizacao_id,
    projeto_bim_id,
    external_id,
    categoria,
    familia,
    tipo,
    nivel,
    propriedades,
    urn_autodesk,
    is_active,
    atualizado_em,
    sync_session
  )
  SELECT 
    p_organizacao_id,
    p_projeto_id,
    item->>'external_id',
    item->>'categoria',
    item->>'familia',
    item->>'tipo',
    item->>'nivel',
    (item->>'propriedades')::jsonb,
    p_urn,
    true, -- Garante que itens que vieram no JSON fiquem ativos
    now(),
    p_sync_session
  FROM jsonb_array_elements(p_elementos) AS item
  ON CONFLICT (projeto_bim_id, external_id) 
  DO UPDATE SET
    categoria = EXCLUDED.categoria,
    familia = EXCLUDED.familia,
    tipo = EXCLUDED.tipo,
    nivel = EXCLUDED.nivel,
    propriedades = EXCLUDED.propriedades,
    urn_autodesk = EXCLUDED.urn_autodesk,
    is_active = true,
    atualizado_em = now(),
    sync_session = EXCLUDED.sync_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_bim_elements_finalize(
    p_projeto_id bigint,
    p_sync_session text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 2. SOFT DELETE (O Pulo do Gato)
  -- Se o elemento pertence a este projeto, MAS a sessão de sincronia é diferente da atual
  -- significa que ele NÃO veio em nenhum dos lotes JSON (foi excluído no Revit).
  UPDATE public.elementos_bim
  SET is_active = false
  WHERE projeto_bim_id = p_projeto_id
    AND (sync_session IS NULL OR sync_session != p_sync_session);
END;
$$;
