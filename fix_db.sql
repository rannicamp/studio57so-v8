DROP FUNCTION IF EXISTS public.find_contact_smart(text);

CREATE OR REPLACE FUNCTION public.find_contact_smart(phone_input text, v_org_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_phone text;
  phone_suffix text;
  phone_ddd text;
  is_brazil boolean;
  found_id uuid;
BEGIN
  -- 1. Limpeza: deixa só números
  clean_phone := regexp_replace(phone_input, '[^0-9]', '', 'g');

  -- 2. É Brasil? (Começa com 55 E tem tamanho de celular BR 12/13 digitos)
  is_brazil := (left(clean_phone, 2) = '55' AND length(clean_phone) >= 12);

  -- 🌎 CAMINHO INTERNACIONAL (EUA, etc)
  IF NOT is_brazil THEN
    SELECT contato_id INTO found_id
    FROM telefones
    WHERE regexp_replace(telefone, '[^0-9]', '', 'g') = clean_phone
      AND organizacao_id = v_org_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN found_id;
  END IF;

  -- 🇧🇷 CAMINHO BRASILEIRO (Lógica flexível do 9º Dígito)
  phone_suffix := right(clean_phone, 8);
  phone_ddd := substring(clean_phone from 3 for 2);

  SELECT contato_id INTO found_id
  FROM telefones
  WHERE 
    (regexp_replace(telefone, '[^0-9]', '', 'g') LIKE '%' || phone_ddd || '%')    -- garante Ddd
    AND
    right(regexp_replace(telefone, '[^0-9]', '', 'g'), 8) = phone_suffix
    AND organizacao_id = v_org_id
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN found_id;
END;
$$;
