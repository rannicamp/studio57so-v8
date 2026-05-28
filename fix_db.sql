DROP FUNCTION IF EXISTS public.find_contact_smart(text);
DROP FUNCTION IF EXISTS public.find_contact_smart(text, bigint);

CREATE OR REPLACE FUNCTION public.find_contact_smart(phone_input text, v_org_id bigint DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_phone text;
  phone_suffix text;
  phone_ddd text;
  is_brazil boolean;
  found_id bigint;
BEGIN
  -- 1. Limpeza: deixa só números
  clean_phone := regexp_replace(phone_input, '[^0-9]', '', 'g');

  IF clean_phone IS NULL OR clean_phone = '' THEN
    RETURN NULL;
  END IF;

  -- 2. É Brasil? (Começa com 55 E tem tamanho de celular BR 12/13 digitos)
  is_brazil := (left(clean_phone, 2) = '55' AND length(clean_phone) >= 12);

  -- 🌎 CAMINHO INTERNACIONAL (EUA, etc)
  IF NOT is_brazil THEN
    -- Para números internacionais (como EUA), comparamos os últimos 10 dígitos (formato nacional nos EUA)
    -- se o número tiver pelo menos 10 dígitos. Caso contrário, comparamos o número completo.
    IF length(clean_phone) >= 10 THEN
      SELECT contato_id INTO found_id
      FROM telefones
      WHERE right(regexp_replace(telefone, '[^0-9]', '', 'g'), 10) = right(clean_phone, 10)
        AND (v_org_id IS NULL OR organizacao_id = v_org_id)
      ORDER BY created_at DESC
      LIMIT 1;
    ELSE
      SELECT contato_id INTO found_id
      FROM telefones
      WHERE regexp_replace(telefone, '[^0-9]', '', 'g') = clean_phone
        AND (v_org_id IS NULL OR organizacao_id = v_org_id)
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
    
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
    AND (v_org_id IS NULL OR organizacao_id = v_org_id)
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN found_id;
END;
$$;
