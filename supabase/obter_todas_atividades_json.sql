CREATE OR REPLACE FUNCTION public.obter_todas_atividades_json(p_organizacao_id bigint)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'empresa_id', a.empresa_id,
      'empreendimento_id', a.empreendimento_id,
      'funcionario_id', a.funcionario_id,
      'diario_obra_id', a.diario_obra_id,
      'criado_por_usuario_id', a.criado_por_usuario_id,
      'etapa', a.etapa,
      'tipo_atividade', a.tipo_atividade,
      'nome', a.nome,
      'descricao', a.descricao,
      'data_inicio_prevista', a.data_inicio_prevista,
      'duracao_dias', a.duracao_dias,
      'data_fim_prevista', a.data_fim_prevista,
      'data_inicio_real', a.data_inicio_real,
      'data_fim_real', a.data_fim_real,
      'status', a.status,
      'responsavel_texto', a.responsavel_texto,
      'dependencies', a.dependencies,
      'custom_class', a.custom_class,
      'created_at', a.created_at,
      'progresso', a.progresso,
      'etapa_id', a.etapa_id,
      'data_fim_original', a.data_fim_original,
      'motivo_adiamento', a.motivo_adiamento,
      'hora_inicio', a.hora_inicio,
      'duracao_horas', a.duracao_horas,
      'is_recorrente', a.is_recorrente,
      'recorrencia_tipo', a.recorrencia_tipo,
      'recorrencia_intervalo', a.recorrencia_intervalo,
      'recorrencia_dias_semana', a.recorrencia_dias_semana,
      'recorrencia_fim', a.recorrencia_fim,
      'contato_id', a.contato_id,
      'atividade_pai_id', a.atividade_pai_id,
      'subetapa_id', a.subetapa_id,
      'organizacao_id', a.organizacao_id,
      -- Relacionamentos aninhados
      'empreendimentos', (
        SELECT jsonb_build_object('empresa_proprietaria_id', e.empresa_proprietaria_id)
        FROM public.empreendimentos e
        WHERE e.id = a.empreendimento_id
      ),
      'anexos', coalesce((
        SELECT jsonb_agg(ax.*)
        FROM public.activity_anexos ax
        WHERE ax.activity_id = a.id
      ), '[]'::jsonb),
      'atividade_pai', (
        SELECT jsonb_build_object('id', p.id, 'nome', p.nome)
        FROM public.activities p
        WHERE p.id = a.atividade_pai_id
      )
    )
  ), '[]'::jsonb)
  INTO result
  FROM public.activities a
  WHERE a.organizacao_id = p_organizacao_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
