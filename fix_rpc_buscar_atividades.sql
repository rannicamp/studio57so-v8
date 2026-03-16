CREATE OR REPLACE FUNCTION public.buscar_atividades_ai(
    p_organizacao_id bigint, 
    p_termo text DEFAULT NULL,
    p_funcionario_id bigint DEFAULT NULL,
    p_empreendimento_id bigint DEFAULT NULL,
    p_status text DEFAULT NULL
)
 RETURNS TABLE(
    id bigint, 
    nome text, 
    descricao text, 
    tipo_atividade text, 
    data_inicio_prevista date, 
    hora_inicio time without time zone, 
    duracao_dias numeric, 
    duracao_horas numeric, 
    status text, 
    funcionario_id bigint, 
    responsavel_texto text, 
    empreendimento_id bigint
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id, a.nome, a.descricao, a.tipo_atividade, 
        a.data_inicio_prevista, a.hora_inicio, 
        a.duracao_dias, a.duracao_horas, 
        a.status, a.funcionario_id, a.responsavel_texto, a.empreendimento_id
    FROM public.activities a
    WHERE a.organizacao_id = p_organizacao_id
      AND (p_status IS NULL AND a.status != 'Concluído' OR a.status = p_status)
      AND (p_termo IS NULL OR a.nome ILIKE '%' || p_termo || '%' OR a.descricao ILIKE '%' || p_termo || '%')
      AND (p_funcionario_id IS NULL OR a.funcionario_id = p_funcionario_id)
      AND (p_empreendimento_id IS NULL OR a.empreendimento_id = p_empreendimento_id)
    ORDER BY a.data_inicio_prevista DESC, a.created_at DESC
    LIMIT 20;
END;
$$;
