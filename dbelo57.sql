-- ESQUEMA DO BANCO DE DADOS (Studio 57)
-- Este arquivo é um espelho SIMPLIFICADO gerado pelo script exportar-db.cjs

CREATE TABLE public.abono_tipos (
    id bigint NOT NULL,
    descricao text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.abonos (
    id bigint NOT NULL,
    funcionario_id bigint NOT NULL,
    data_abono date NOT NULL,
    horas_abonadas numeric NOT NULL,
    observacao text,
    criado_por_usuario_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    caminho_arquivo text,
    tipo_abono_id bigint,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.activities (
    id bigint NOT NULL,
    empresa_id bigint,
    empreendimento_id bigint,
    funcionario_id bigint,
    diario_obra_id bigint,
    criado_por_usuario_id uuid NOT NULL,
    etapa text,
    tipo_atividade character varying NOT NULL,
    nome text NOT NULL,
    descricao text,
    data_inicio_prevista date,
    duracao_dias numeric,
    data_fim_prevista date,
    data_inicio_real date,
    data_fim_real date,
    status character varying DEFAULT 'Não iniciado'::character varying,
    responsavel_texto text,
    dependencies text,
    custom_class text,
    created_at timestamp with time zone DEFAULT now(),
    progresso integer DEFAULT 0,
    etapa_id bigint,
    data_fim_original date,
    motivo_adiamento text,
    hora_inicio time without time zone,
    duracao_horas numeric,
    is_recorrente boolean DEFAULT false,
    recorrencia_tipo text,
    recorrencia_intervalo integer DEFAULT 1,
    recorrencia_dias_semana jsonb,
    recorrencia_fim date,
    contato_id bigint,
    atividade_pai_id bigint,
    subetapa_id bigint,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.activity_anexos (
    id bigint NOT NULL,
    activity_id bigint NOT NULL,
    file_name text,
    file_path text,
    file_type text,
    file_size bigint,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.ai_planning_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organizacao_id bigint NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT 'Planejamento Sem Título'::text,
    messages jsonb DEFAULT '[]'::jsonb,
    current_plan jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.app_logs (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    origem text,
    mensagem text,
    payload jsonb,
    usuario_id uuid,
    organizacao_id bigint
);

CREATE TABLE public.atividades_elementos (
    id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    atividade_id bigint NOT NULL,
    projeto_bim_id bigint NOT NULL,
    external_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.auditoria_ia_logs (
    id bigint NOT NULL,
    lancamento_id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    status_auditoria text NOT NULL,
    valor_identificado numeric,
    valor_lancamento numeric,
    diferenca numeric,
    confianca_ia numeric,
    analise_ia text,
    caminhos_arquivos ARRAY,
    modelo_ia text DEFAULT 'gemini-1.5-flash'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.automacoes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    gatilho_tipo text NOT NULL,
    gatilho_config jsonb,
    acao_tipo text NOT NULL,
    acao_config jsonb,
    ativo boolean NOT NULL DEFAULT true,
    organizacao_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.banco_arquivos_ofx (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    organizacao_id bigint,
    conta_id bigint,
    arquivo_url text,
    nome_arquivo text,
    data_envio timestamp with time zone DEFAULT now(),
    enviado_por text,
    periodo_inicio date,
    periodo_fim date,
    status text DEFAULT 'Processado'::text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.banco_de_horas (
    id bigint NOT NULL,
    funcionario_id bigint NOT NULL,
    mes_referencia date NOT NULL,
    saldo_minutos integer NOT NULL,
    status text NOT NULL,
    lancamento_id bigint,
    criado_em timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.banco_transacoes_ofx (
    fitid text NOT NULL,
    arquivo_id uuid,
    organizacao_id bigint,
    conta_id bigint,
    data_transacao date NOT NULL,
    valor numeric NOT NULL,
    tipo text NOT NULL,
    descricao_banco text,
    memo_banco text,
    lancamento_id_vinculado bigint,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.bim_mapeamentos_propriedades (
    id bigint NOT NULL DEFAULT nextval('bim_mapeamentos_propriedades_id_seq'::regclass),
    organizacao_id bigint NOT NULL,
    propriedade_nome text NOT NULL,
    categoria_bim text,
    familia_bim text,
    tipo_vinculo text NOT NULL DEFAULT 'material'::text,
    escopo text NOT NULL DEFAULT 'categoria'::text,
    material_id bigint,
    sinapi_id bigint,
    unidade_override text,
    criado_por uuid,
    criado_em timestamp with time zone NOT NULL DEFAULT now(),
    atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
    propriedade_quantidade text,
    fator_conversao text,
    tipo_bim text,
    elemento_id text,
    vinculo_pai_id bigint
);

CREATE TABLE public.bim_notas (
    id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    projeto_bim_id bigint NOT NULL,
    atividade_id bigint,
    titulo text NOT NULL,
    descricao text,
    status text NOT NULL DEFAULT 'aberta'::text,
    prioridade text NOT NULL DEFAULT 'normal'::text,
    tipo text NOT NULL DEFAULT 'geral'::text,
    camera_state jsonb NOT NULL,
    snapshot text,
    criado_por uuid DEFAULT auth.uid(),
    responsavel_id uuid,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    excluido boolean NOT NULL DEFAULT false,
    markup_svg text
);

CREATE TABLE public.bim_notas_comentarios (
    id bigint NOT NULL,
    nota_id bigint NOT NULL,
    usuario_id uuid DEFAULT auth.uid(),
    texto text NOT NULL,
    anexo_url text,
    criado_em timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.bim_notas_elementos (
    id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    nota_id bigint NOT NULL,
    projeto_bim_id bigint NOT NULL,
    external_id text NOT NULL,
    criado_em timestamp with time zone DEFAULT now()
);

CREATE TABLE public.bim_vistas_federadas (
    id bigint NOT NULL,
    nome text NOT NULL,
    organizacao_id bigint NOT NULL,
    empreendimento_id bigint NOT NULL,
    modelos_urns ARRAY NOT NULL,
    camera_state jsonb,
    criado_em timestamp with time zone DEFAULT now(),
    criado_por uuid DEFAULT auth.uid(),
    projetos_ids ARRAY
);

CREATE TABLE public.cadastro_empresa (
    id bigint NOT NULL,
    cnpj text,
    razao_social text NOT NULL,
    nome_fantasia text,
    inscricao_estadual text,
    inscricao_municipal text,
    address_street text,
    address_number text,
    address_complement text,
    cep character varying(9),
    city text,
    state character varying(2),
    neighborhood text,
    telefone character varying(15),
    email text,
    responsavel_legal text,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL,
    meta_business_id text,
    objeto_social text,
    capital_social numeric,
    natureza_juridica text,
    logo_url text,
    responsavel_id bigint
);

CREATE TABLE public.campos_sistema (
    id bigint NOT NULL,
    tabela_id bigint NOT NULL,
    nome_coluna text NOT NULL,
    nome_exibicao text NOT NULL,
    tipo_dado text,
    visivel_listagem boolean DEFAULT true,
    visivel_filtro boolean DEFAULT true,
    editavel boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.cargos (
    id bigint NOT NULL,
    nome text NOT NULL,
    descricao text,
    cbo text,
    organizacao_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.categorias_financeiras (
    id bigint NOT NULL DEFAULT nextval('categorias_financeiras_id_seq'::regclass),
    nome text NOT NULL,
    tipo text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    parent_id bigint,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.chat_conversations (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.chat_messages (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    conversation_id uuid,
    sender_type text NOT NULL,
    message_content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.colunas_funil (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    funil_id uuid NOT NULL,
    nome character varying(255) NOT NULL,
    ordem integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL,
    cor text DEFAULT 'bg-gray-100'::text,
    tipo_coluna text DEFAULT 'etapa'::text
);

CREATE TABLE public.conciliacao_historico (
    id bigint NOT NULL,
    data_conciliacao timestamp with time zone NOT NULL DEFAULT now(),
    usuario_id uuid NOT NULL,
    conta_financeira_id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    caminho_arquivo_ofx text NOT NULL,
    periodo_inicio_extrato date NOT NULL,
    periodo_fim_extrato date NOT NULL,
    lancamentos_conciliados jsonb,
    total_conciliado numeric NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.configuracoes_belvo (
    id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    secret_id text NOT NULL,
    secret_password text NOT NULL,
    environment text DEFAULT 'sandbox'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.configuracoes_ia (
    id bigint NOT NULL,
    nome text NOT NULL DEFAULT 'stella_whatsapp'::text,
    system_prompt text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.configuracoes_venda (
    id bigint NOT NULL,
    empreendimento_id bigint NOT NULL,
    percentual_entrada numeric,
    num_parcelas_entrada integer,
    data_inicio_entrada date,
    percentual_obra numeric,
    num_parcelas_obra integer,
    data_inicio_obra date,
    percentual_saldo_remanescente numeric,
    created_at timestamp with time zone DEFAULT now(),
    valor_cub numeric,
    desconto_percentual numeric,
    entrada_percentual numeric,
    parcelas_obra_percentual numeric,
    saldo_remanescente_percentual numeric,
    data_primeira_parcela_entrada date,
    data_primeira_parcela_obra date,
    organizacao_id bigint
);

CREATE TABLE public.configuracoes_whatsapp (
    id bigint NOT NULL,
    empresa_id bigint,
    whatsapp_phone_number_id text,
    whatsapp_business_account_id text,
    whatsapp_permanent_token text,
    verify_token text,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.contas_financeiras (
    id bigint NOT NULL DEFAULT nextval('contas_financeiras_id_seq'::regclass),
    nome text NOT NULL,
    tipo text NOT NULL,
    saldo_inicial numeric NOT NULL DEFAULT 0,
    instituicao text,
    empresa_id bigint,
    created_at timestamp with time zone DEFAULT now(),
    agencia text,
    numero_conta text,
    chaves_pix jsonb,
    limite_cheque_especial numeric,
    limite_credito numeric,
    dia_fechamento_fatura integer,
    dia_pagamento_fatura integer,
    conta_debito_fatura_id bigint,
    organizacao_id bigint NOT NULL,
    pluggy_item_id text,
    pluggy_account_id text,
    belvo_link_id text,
    belvo_account_id text,
    codigo_banco_ofx text,
    numero_conta_ofx text,
    conta_pai_id bigint
);

CREATE TABLE public.contatos (
    id bigint NOT NULL,
    empresa_id bigint,
    nome text,
    cargo text,
    address_street text,
    address_number text,
    address_complement text,
    cep character varying(9),
    city text,
    state character varying(2),
    neighborhood text,
    created_at timestamp with time zone DEFAULT now(),
    tipo_contato USER-DEFINED,
    foto_url text,
    razao_social text,
    nome_fantasia text,
    cnpj text,
    inscricao_estadual text,
    inscricao_municipal text,
    responsavel_legal text,
    cpf text,
    rg text,
    birth_date date,
    estado_civil text,
    contract_role text,
    admission_date date,
    demission_date date,
    status text DEFAULT 'Ativo'::text,
    base_salary text,
    total_salary text,
    daily_value text,
    payment_method text,
    pix_key text,
    bank_details text,
    observations text,
    numero_ponto integer,
    nacionalidade text,
    personalidade_juridica text,
    data_fundacao date,
    tipo_servico_produto text,
    pessoa_contato text,
    objetivo text,
    is_awaiting_name_response boolean DEFAULT false,
    origem text,
    meta_lead_id text,
    meta_ad_id text,
    meta_adgroup_id text,
    meta_page_id text,
    meta_form_id text,
    meta_created_time timestamp with time zone,
    meta_form_data jsonb,
    organizacao_id bigint NOT NULL,
    meta_ad_name text,
    conjuge_id bigint,
    regime_bens text,
    meta_campaign_id text,
    meta_campaign_name text,
    meta_adset_name text,
    criado_por uuid,
    criado_por_usuario_id uuid,
    creci text,
    lixeira boolean DEFAULT false,
    renda_familiar numeric,
    terceirizado_ativo boolean DEFAULT false,
    fgts boolean DEFAULT false,
    mais_de_3_anos_clt boolean DEFAULT false,
    meta_adset_id text,
    instagram_username text
);

CREATE TABLE public.contatos_no_funil (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contato_id bigint NOT NULL,
    coluna_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    numero_card integer,
    produto_id bigint,
    simulacao_id bigint,
    corretor_id bigint,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.contatos_no_funil_produtos (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contato_no_funil_id uuid NOT NULL,
    produto_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.contracheques (
    id bigint NOT NULL,
    funcionario_id bigint NOT NULL,
    mes_referencia date NOT NULL,
    salario_base numeric DEFAULT 0,
    valor_diaria_base numeric DEFAULT 0,
    dias_trabalhados integer DEFAULT 0,
    valor_total_diarias numeric DEFAULT 0,
    bonus numeric DEFAULT 0,
    salario_bruto numeric DEFAULT 0,
    faixa_inss numeric,
    desconto_inss numeric DEFAULT 0,
    base_calculo_fgts numeric DEFAULT 0,
    valor_fgts numeric DEFAULT 0,
    base_calculo_irrf numeric DEFAULT 0,
    outros_descontos numeric DEFAULT 0,
    adicionais numeric DEFAULT 0,
    custo_inss_patronal numeric DEFAULT 0,
    custo_rat numeric DEFAULT 0,
    custo_terceiros numeric DEFAULT 0,
    valor_liquido numeric,
    status text NOT NULL DEFAULT 'Pendente'::text,
    observacoes text,
    criado_em timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.contrato_anexos (
    id bigint NOT NULL,
    contrato_id bigint NOT NULL,
    tipo_documento text NOT NULL,
    caminho_arquivo text NOT NULL,
    nome_arquivo text NOT NULL,
    usuario_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.contrato_parcelas (
    id bigint NOT NULL,
    contrato_id bigint NOT NULL,
    descricao text NOT NULL,
    tipo text NOT NULL,
    data_vencimento date NOT NULL,
    valor_parcela numeric NOT NULL,
    status_pagamento text NOT NULL DEFAULT 'Pendente'::text,
    lancamento_id bigint,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.contrato_permutas (
    id bigint NOT NULL,
    contrato_id bigint NOT NULL,
    descricao text NOT NULL,
    valor numeric NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    data_registro date NOT NULL DEFAULT now(),
    valor_permutado numeric NOT NULL DEFAULT 0,
    organizacao_id bigint
);

CREATE TABLE public.contrato_produtos (
    id bigint NOT NULL,
    contrato_id bigint NOT NULL,
    produto_id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.contratos (
    id bigint NOT NULL,
    contato_id bigint,
    produto_id bigint,
    empreendimento_id bigint,
    data_venda date NOT NULL DEFAULT CURRENT_DATE,
    valor_final_venda numeric NOT NULL,
    status_contrato text NOT NULL DEFAULT 'Em assinatura'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    simulacao_id bigint,
    corretor_id bigint,
    indice_reajuste text,
    multa_inadimplencia_percentual numeric,
    juros_mora_inadimplencia_percentual numeric,
    clausula_penal_percentual numeric,
    numero_contrato integer,
    organizacao_id bigint NOT NULL,
    percentual_comissao_corretagem numeric,
    valor_comissao_corretagem numeric,
    forma_pagamento_corretagem text,
    observacoes_contrato text,
    conjuge_id bigint,
    regime_bens text,
    representante_id bigint,
    conta_bancaria_id bigint,
    criado_por_usuario_id uuid,
    modelo_contrato_id bigint,
    tipo_documento text NOT NULL DEFAULT 'CONTRATO'::text,
    lixeira boolean DEFAULT false,
    periodo_correcao text DEFAULT 'anual'::text
);

CREATE TABLE public.contratos_terceirizados (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL,
    fornecedor_id bigint NOT NULL,
    titulo text NOT NULL,
    data_inicio date NOT NULL,
    data_fim date,
    valor_total numeric,
    descricao text,
    status text DEFAULT 'Ativo'::text
);

CREATE TABLE public.contratos_terceirizados_anexos (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    contrato_id bigint NOT NULL,
    nome_arquivo text NOT NULL,
    caminho_arquivo text NOT NULL,
    tipo_arquivo text,
    tamanho_bytes bigint,
    uploaded_by uuid,
    tipo_documento_id bigint,
    descricao text,
    organizacao_id bigint
);

CREATE TABLE public.crm_notas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contato_no_funil_id uuid NOT NULL,
    contato_id bigint NOT NULL,
    conteudo text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    usuario_id uuid,
    organizacao_id bigint
);

CREATE TABLE public.debug_notificacoes (
    id integer NOT NULL DEFAULT nextval('debug_notificacoes_id_seq'::regclass),
    data_hora timestamp without time zone DEFAULT now(),
    tabela text,
    regra_id integer,
    nome_regra text,
    valor_novo text,
    valor_gatilho text,
    passou_no_filtro boolean,
    coluna_monitorada text,
    organizacao_id bigint DEFAULT 2
);

CREATE TABLE public.diarios_obra (
    id bigint NOT NULL,
    empreendimento_id bigint NOT NULL,
    data_relatorio character varying(10) NOT NULL,
    rdo_numero character varying(50),
    responsavel_rdo text,
    condicoes_climaticas text,
    condicoes_trabalho text,
    status_atividades jsonb,
    mao_de_obra jsonb,
    ocorrencias_do_dia jsonb,
    fotos_do_dia jsonb,
    created_at timestamp with time zone DEFAULT now(),
    usuario_responsavel_id uuid,
    organizacao_id bigint NOT NULL,
    pdf_url text
);

CREATE TABLE public.disciplinas_projetos (
    id bigint NOT NULL,
    sigla text NOT NULL,
    nome text NOT NULL,
    organizacao_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.documento_tipos (
    id bigint NOT NULL,
    sigla text NOT NULL,
    descricao text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.documentos_funcionarios (
    id bigint NOT NULL,
    funcionario_id bigint NOT NULL,
    nome_documento text NOT NULL,
    caminho_arquivo text NOT NULL,
    data_upload timestamp with time zone DEFAULT now(),
    criado_por_usuario_id uuid,
    tipo_documento_id bigint,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.elementos_bim (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organizacao_id bigint NOT NULL,
    projeto_bim_id bigint NOT NULL,
    external_id text NOT NULL,
    categoria text,
    familia text,
    tipo text,
    nivel text,
    propriedades jsonb DEFAULT '{}'::jsonb,
    status_execucao text DEFAULT 'nao_iniciado'::text,
    criado_em timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    atualizado_em timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    urn_autodesk text,
    is_active boolean DEFAULT true,
    sync_session text,
    etapa_id bigint,
    subetapa_id bigint
);

CREATE TABLE public.email_configuracoes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    organizacao_id bigint NOT NULL,
    email text NOT NULL,
    nome_remetente text,
    imap_host text NOT NULL,
    imap_port integer NOT NULL DEFAULT 993,
    imap_user text NOT NULL,
    smtp_host text NOT NULL,
    smtp_port integer NOT NULL DEFAULT 465,
    smtp_user text NOT NULL,
    senha_app text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    assinatura_texto text DEFAULT ''::text,
    assinatura_usar_novos boolean DEFAULT true,
    assinatura_usar_respostas boolean DEFAULT true,
    assinatura_incluir_foto boolean DEFAULT true,
    conta_apelido text,
    last_sync_uid bigint DEFAULT 0
);

CREATE TABLE public.email_messages_cache (
    id bigint NOT NULL,
    account_id uuid NOT NULL,
    uid bigint NOT NULL,
    folder_path text NOT NULL,
    subject text,
    from_text text,
    to_text text,
    date timestamp with time zone,
    preview text,
    html_body text,
    text_body text,
    flags jsonb DEFAULT '[]'::jsonb,
    has_attachments boolean DEFAULT false,
    attachments_meta jsonb DEFAULT '[]'::jsonb,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    conteudo_cache jsonb,
    cc_text text,
    bcc_text text,
    organizacao_id bigint
);

CREATE TABLE public.email_regras (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    organizacao_id bigint,
    nome text NOT NULL,
    ativo boolean DEFAULT true,
    ordem integer DEFAULT 0,
    condicoes jsonb NOT NULL DEFAULT '[]'::jsonb,
    acoes jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    account_id uuid
);

CREATE TABLE public.emails (
    id bigint NOT NULL,
    contato_id bigint NOT NULL,
    email text NOT NULL,
    tipo text,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.empreendimento_anexos (
    id bigint NOT NULL,
    empreendimento_id bigint NOT NULL,
    tipo_documento_id bigint,
    caminho_arquivo text NOT NULL,
    nome_arquivo text,
    descricao text,
    usuario_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    titulo text,
    categoria_aba text,
    usar_para_pesquisa boolean DEFAULT false,
    pode_enviar_anexo boolean DEFAULT false,
    status text DEFAULT 'Pendente'::text,
    organizacao_id bigint,
    thumbnail_url text,
    empresa_id bigint,
    disponivel_corretor boolean DEFAULT false
);

CREATE TABLE public.empreendimento_documento_embeddings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    empreendimento_id bigint NOT NULL,
    anexo_id bigint NOT NULL,
    content text NOT NULL,
    embedding USER-DEFINED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.empreendimentos (
    id bigint NOT NULL,
    empresa_proprietaria_id bigint NOT NULL,
    nome text NOT NULL,
    address_street text,
    address_number text,
    address_complement text,
    cep character varying(9),
    city text,
    state character varying(2),
    neighborhood text,
    data_inicio character varying(10),
    data_fim_prevista character varying(10),
    status character varying(50) DEFAULT 'Em Andamento'::character varying,
    valor_total character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    incorporadora_id bigint,
    construtora_id bigint,
    nome_empreendimento text,
    matricula_numero character varying(50),
    matricula_cartorio text,
    terreno_area_total character varying(50),
    estrutura_tipo text,
    alvenaria_tipo text,
    cobertura_detalhes text,
    acabamentos jsonb,
    unidades jsonb,
    prazo_entrega text,
    indice_reajuste text,
    dados_contrato text,
    listado_para_venda boolean DEFAULT false,
    organizacao_id bigint NOT NULL,
    imagem_capa_url text,
    logo_url text,
    thumbnail_url text,
    observacoes text
);

CREATE TABLE public.empresa_anexos (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    caminho_arquivo text NOT NULL,
    nome_arquivo text,
    descricao text,
    tipo_documento_id bigint,
    categoria_aba text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    thumbnail_url text,
    conteudo_extraido text
);

CREATE TABLE public.estoque (
    id bigint NOT NULL,
    empreendimento_id bigint NOT NULL,
    material_id bigint NOT NULL,
    quantidade_atual numeric NOT NULL DEFAULT 0,
    unidade_medida text,
    custo_medio numeric NOT NULL DEFAULT 0,
    ultima_atualizacao timestamp with time zone NOT NULL DEFAULT now(),
    quantidade_em_uso numeric NOT NULL DEFAULT 0,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.etapa_obra (
    id bigint NOT NULL,
    nome_etapa text NOT NULL,
    codigo_etapa text,
    custo_previsto numeric,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.faturas_cartao (
    id bigint NOT NULL,
    conta_id bigint NOT NULL,
    mes_referencia text NOT NULL,
    data_vencimento date NOT NULL,
    status text NOT NULL DEFAULT 'Aberta'::text,
    organizacao_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    data_fechamento date
);

CREATE TABLE public.feedback (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    usuario_id uuid,
    pagina text,
    descricao text NOT NULL,
    status text DEFAULT 'Aberto'::text,
    captura_de_tela_url text,
    organizacao_id bigint NOT NULL,
    link_opcional text,
    imagem_url text,
    diagnostico text,
    plano_solucao text
);

CREATE TABLE public.feriados (
    id bigint NOT NULL,
    data_feriado date NOT NULL,
    descricao text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    tipo text NOT NULL DEFAULT 'Integral'::text,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.funcionarios (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    empreendimento_atual_id bigint,
    full_name text NOT NULL,
    cpf character varying(14) NOT NULL,
    rg character varying(20),
    birth_date character varying(10),
    phone character varying(15),
    email text,
    address_street text,
    address_number text,
    address_complement text,
    cep character varying(9),
    city text,
    state character varying(2),
    neighborhood text,
    admission_date character varying(10) NOT NULL,
    base_salary character varying(20),
    total_salary character varying(20),
    daily_value character varying(20),
    payment_method text,
    pix_key text,
    bank_details text,
    aso_doc text,
    contract_doc text,
    identity_doc text,
    observations text,
    created_at timestamp with time zone DEFAULT now(),
    foto_url text,
    estado_civil text,
    status text DEFAULT 'Ativo'::text,
    demission_date date,
    numero_ponto integer,
    jornada_id bigint,
    contato_id bigint,
    organizacao_id bigint NOT NULL,
    cargo_id bigint
);

CREATE TABLE public.funcoes (
    id bigint NOT NULL,
    nome_funcao text NOT NULL,
    descricao text,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.funis (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    empreendimento_id bigint,
    nome character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL,
    is_sistema boolean DEFAULT false
);

CREATE TABLE public.historico_lancamentos_financeiros (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    lancamento_id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    acao text NOT NULL,
    campo_alterado text,
    valor_antigo text,
    valor_novo text,
    usuario_id uuid,
    criado_em timestamp with time zone DEFAULT now(),
    alterado_apos_conciliacao boolean DEFAULT false
);

CREATE TABLE public.historico_movimentacao_funil (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contato_no_funil_id uuid NOT NULL,
    coluna_anterior_id uuid,
    coluna_nova_id uuid,
    usuario_id uuid,
    data_movimentacao timestamp with time zone NOT NULL DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.historico_salarial (
    id bigint NOT NULL,
    funcionario_id bigint NOT NULL,
    data_inicio_vigencia date NOT NULL,
    salario_base numeric,
    valor_diaria numeric,
    motivo_alteracao text,
    criado_em timestamp with time zone DEFAULT now(),
    criado_por_usuario_id uuid,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.historico_vgv (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    data_alteracao timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    empreendimento_id bigint NOT NULL,
    produto_id bigint NOT NULL,
    valor_produto_anterior numeric,
    valor_produto_novo numeric,
    vgv_anterior numeric,
    vgv_novo numeric,
    organizacao_id integer,
    usuario_alteracao uuid
);

CREATE TABLE public.indices_financeiros (
    id bigint NOT NULL DEFAULT nextval('indices_financeiros_id_seq'::regclass),
    nome_indice text NOT NULL,
    descricao text,
    configuracao_filtro jsonb NOT NULL,
    criado_em timestamp with time zone DEFAULT now(),
    criado_por uuid,
    organizacao_id bigint
);

CREATE TABLE public.indices_governamentais (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome_indice text NOT NULL,
    mes_ano text NOT NULL,
    data_referencia date NOT NULL,
    valor_mensal numeric NOT NULL,
    organizacao_id integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    descricao text
);

CREATE TABLE public.instagram_conversations (
    id bigint NOT NULL DEFAULT nextval('instagram_conversations_id_seq'::regclass),
    organizacao_id bigint NOT NULL,
    thread_id text NOT NULL,
    instagram_account_id text NOT NULL,
    participant_id text,
    participant_name text,
    participant_username text,
    participant_profile_pic text,
    snippet text,
    unread_count integer DEFAULT 0,
    last_message_at timestamp with time zone,
    is_archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    instagram_conversation_id text,
    contato_id bigint
);

CREATE TABLE public.instagram_messages (
    id bigint NOT NULL DEFAULT nextval('instagram_messages_id_seq'::regclass),
    organizacao_id bigint NOT NULL,
    conversation_id bigint NOT NULL,
    message_id text NOT NULL,
    from_id text,
    from_name text,
    content text,
    message_type text DEFAULT 'text'::text,
    direction text NOT NULL,
    is_read boolean DEFAULT false,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.integracoes_google (
    id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    token_expires_at timestamp with time zone,
    scope text,
    ad_account_id text,
    calendar_id text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.integracoes_meta (
    id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    token_expires_at timestamp with time zone,
    ad_account_id text,
    pixel_id text,
    page_id text,
    whatsapp_business_account_id text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    nome_conta text,
    meta_user_id text,
    status text DEFAULT 'inativo'::text,
    page_access_token text,
    instagram_business_account_id text
);

CREATE TABLE public.jornada_detalhes (
    id bigint NOT NULL,
    jornada_id bigint NOT NULL,
    dia_semana integer NOT NULL,
    horario_entrada time without time zone,
    horario_saida_intervalo time without time zone,
    horario_volta_intervalo time without time zone,
    horario_saida time without time zone,
    horas_feriado numeric,
    organizacao_id bigint
);

CREATE TABLE public.jornadas (
    id bigint NOT NULL,
    nome_jornada text NOT NULL,
    carga_horaria_semanal numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    tolerancia_minutos integer DEFAULT 5,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.kpis_personalizados (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    usuario_id uuid NOT NULL,
    titulo text NOT NULL,
    descricao text,
    modulo text NOT NULL,
    tipo_calculo text NOT NULL,
    filtros jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    exibir_no_painel boolean NOT NULL DEFAULT true,
    grupo text,
    organizacao_id bigint NOT NULL,
    tipo_kpi text DEFAULT 'financeiro'::text,
    operacao text,
    tabela_fonte text,
    coluna_alvo text,
    ordem integer DEFAULT 999,
    tipo_visualizacao text DEFAULT 'card'::text,
    agrupamento_tempo text DEFAULT 'mes'::text
);

CREATE TABLE public.lancamentos (
    id bigint NOT NULL DEFAULT nextval('lancamentos_id_seq'::regclass),
    descricao text NOT NULL,
    valor numeric NOT NULL,
    data_transacao date NOT NULL DEFAULT CURRENT_DATE,
    tipo text NOT NULL,
    status text NOT NULL DEFAULT 'Pendente'::text,
    conta_id bigint NOT NULL,
    categoria_id bigint,
    empreendimento_id bigint,
    etapa_id bigint,
    pedido_compra_id bigint,
    funcionario_id bigint,
    created_at timestamp with time zone DEFAULT now(),
    data_vencimento date,
    data_pagamento date,
    parcela_info text,
    recorrencia_id bigint,
    favorecido_contato_id bigint,
    conciliado boolean DEFAULT false,
    fitid text,
    empresa_id bigint,
    criado_por_usuario_id uuid,
    observacao text,
    mes_competencia date,
    transferencia_id uuid,
    auditoria_verificado boolean NOT NULL DEFAULT false,
    organizacao_id bigint NOT NULL,
    parcela_grupo uuid,
    frequencia text,
    recorrencia_data_fim date,
    pluggy_transaction_id text,
    status_auditoria_ia text DEFAULT 'Nao Auditado'::text,
    antecipacao_grupo_id uuid,
    fatura_id bigint,
    fitid_banco text,
    origem_criacao text DEFAULT 'Manual'::text,
    contrato_id bigint,
    lancamento_ativo_id bigint,
    agrupamento_id uuid
);

CREATE TABLE public.lancamentos_anexos (
    id bigint NOT NULL,
    lancamento_id bigint NOT NULL,
    tipo_documento_id bigint,
    descricao text,
    caminho_arquivo text NOT NULL,
    nome_arquivo text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.latest_ad_snapshots (
    id bigint,
    ad_id text,
    data_snapshot date,
    spend numeric,
    impressions integer,
    clicks integer,
    reach integer,
    leads integer,
    created_at timestamp with time zone,
    organizacao_id bigint,
    ad_name text,
    campaign_name text,
    adset_name text
);

CREATE TABLE public.logs_erros_ui (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    mensagem text NOT NULL,
    detalhes text,
    usuario_id uuid,
    url_atual text,
    organizacao_id bigint,
    browser_info text
);

CREATE TABLE public.marcas_uploads (
    id bigint NOT NULL,
    descricao text,
    caminho_arquivo text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.materiais (
    id bigint NOT NULL,
    empresa_fornecedor_id bigint,
    nome text,
    descricao text,
    unidade_medida text,
    preco_unitario numeric,
    Grupo text,
    Código da Composição text,
    Origem text,
    classificacao text NOT NULL DEFAULT 'Insumo'::text,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.meta_ads (
    id text NOT NULL,
    name text,
    adset_id text,
    campaign_id text,
    status text,
    creative_title text,
    creative_body text,
    thumbnail_url text,
    organizacao_id bigint NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now(),
    created_time timestamp with time zone,
    insights jsonb
);

CREATE TABLE public.meta_ads_historico (
    id bigint NOT NULL,
    ad_id text NOT NULL,
    data_snapshot date NOT NULL DEFAULT CURRENT_DATE,
    spend numeric,
    impressions integer,
    clicks integer,
    reach integer,
    leads integer,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL,
    ad_name text,
    campaign_name text,
    adset_name text
);

CREATE TABLE public.meta_adsets (
    id text NOT NULL,
    name text,
    campaign_id text,
    status text,
    daily_budget bigint,
    lifetime_budget bigint,
    billing_event text,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    organizacao_id bigint NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.meta_ativos (
    id text NOT NULL,
    organizacao_id bigint NOT NULL,
    tipo text NOT NULL,
    nome text NOT NULL,
    empreendimento_id bigint,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.meta_campaigns (
    id text NOT NULL,
    name text,
    objective text,
    status text,
    buying_type text,
    spend_cap bigint,
    account_id text,
    organizacao_id bigint NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.meta_form_config (
    id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    meta_form_id text NOT NULL,
    meta_field_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    campo_destino text
);

CREATE TABLE public.meta_forms_catalog (
    id bigint NOT NULL,
    organizacao_id bigint NOT NULL,
    form_id text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'ACTIVE'::text,
    last_synced timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.modelos_contrato (
    id bigint NOT NULL,
    empreendimento_id bigint NOT NULL,
    nome_modelo text NOT NULL,
    clausulas_html text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.monitor_visitas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    pagina text NOT NULL,
    origem text,
    dispositivo text,
    visitante_id uuid,
    data_acesso timestamp with time zone DEFAULT now(),
    session_id uuid,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    url_completa text,
    ip text,
    organizacao_id bigint
);

CREATE TABLE public.movimentacoes_estoque (
    id bigint NOT NULL,
    estoque_id bigint NOT NULL,
    tipo text NOT NULL,
    quantidade numeric NOT NULL,
    data_movimentacao timestamp with time zone NOT NULL DEFAULT now(),
    pedido_compra_id bigint,
    usuario_id uuid,
    etapa_id bigint,
    observacao text,
    funcionario_id bigint,
    organizacao_id bigint
);

CREATE TABLE public.notificacoes (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    link text,
    lida boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint,
    tipo text DEFAULT 'sistema'::text,
    enviar_push boolean DEFAULT false,
    icone text DEFAULT 'fa-bell'::text
);

CREATE TABLE public.notification_subscriptions (
    id bigint NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    user_id uuid NOT NULL,
    organizacao_id bigint,
    endpoint text NOT NULL,
    subscription_data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ocorrencias (
    id bigint NOT NULL,
    empreendimento_id bigint,
    atividade_id bigint,
    funcionario_id bigint,
    tipo text NOT NULL,
    descricao text NOT NULL,
    data_ocorrencia text,
    hora_ocorrencia text,
    severidade character varying(20) DEFAULT 'Média'::character varying,
    resolvida boolean DEFAULT false,
    data_resolucao character varying(10),
    observacoes text,
    created_at timestamp with time zone DEFAULT now(),
    diario_obra_id bigint,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.orcamento_itens (
    id bigint NOT NULL,
    orcamento_id bigint NOT NULL,
    material_id bigint,
    descricao text NOT NULL,
    unidade text,
    quantidade numeric NOT NULL DEFAULT 1,
    preco_unitario numeric,
    custo_total numeric,
    categoria text DEFAULT 'Outros'::text,
    status_cotacao text DEFAULT 'Pendente de Cotação'::text,
    created_at timestamp with time zone DEFAULT now(),
    etapa_id bigint,
    ordem integer,
    subetapa_id bigint,
    organizacao_id bigint NOT NULL,
    sinapi_id bigint,
    origem text DEFAULT 'manual'::text,
    bim_elemento_ids ARRAY,
    bim_projeto_id bigint
);

CREATE TABLE public.orcamentos (
    id bigint NOT NULL,
    empreendimento_id bigint NOT NULL,
    nome_orcamento text NOT NULL,
    versao integer DEFAULT 1,
    custo_total_previsto numeric DEFAULT 0,
    status text DEFAULT 'Em Elaboração'::text,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.organizacoes (
    id bigint NOT NULL,
    nome text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    public_form_slug text,
    entidade_principal_id bigint
);

CREATE TABLE public.parcelas_adicionais (
    id bigint NOT NULL,
    configuracao_venda_id bigint,
    sequencia integer,
    tipo text,
    descricao text,
    data_pagamento date NOT NULL,
    valor numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.pedidos_compra (
    id bigint NOT NULL,
    empreendimento_id bigint NOT NULL,
    solicitante_id uuid,
    comprador_id uuid,
    data_solicitacao timestamp with time zone DEFAULT now(),
    data_entrega_prevista date,
    status text DEFAULT 'Pedido Realizado'::text,
    justificativa text,
    valor_total_estimado numeric,
    titulo text,
    turno_entrega text,
    organizacao_id bigint NOT NULL,
    data_entrega_real date,
    observacoes text,
    fase_id uuid
);

CREATE TABLE public.pedidos_compra_anexos (
    id bigint NOT NULL,
    pedido_compra_id bigint NOT NULL,
    caminho_arquivo text NOT NULL,
    descricao text,
    nome_arquivo text,
    created_at timestamp with time zone DEFAULT now(),
    usuario_id uuid,
    organizacao_id bigint
);

CREATE TABLE public.pedidos_compra_historico_fases (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    pedido_compra_id bigint NOT NULL,
    fase_anterior_id uuid,
    fase_nova_id uuid,
    usuario_id uuid,
    organizacao_id bigint NOT NULL,
    data_movimentacao timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.pedidos_compra_itens (
    id bigint NOT NULL,
    pedido_compra_id bigint NOT NULL,
    orcamento_item_id bigint,
    material_id bigint,
    descricao_item text NOT NULL,
    quantidade_solicitada numeric NOT NULL,
    unidade_medida character varying,
    fornecedor_id bigint,
    preco_unitario_real numeric,
    custo_total_real numeric,
    etapa_id bigint,
    tipo_operacao text NOT NULL DEFAULT 'Compra'::text,
    dias_aluguel integer,
    subetapa_id bigint,
    organizacao_id bigint,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.pedidos_compra_status_historico_legacy (
    id bigint NOT NULL,
    pedido_compra_id bigint NOT NULL,
    status_anterior text,
    status_novo text NOT NULL,
    data_mudanca timestamp with time zone NOT NULL DEFAULT now(),
    alterado_por_usuario_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.pedidos_fases (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    organizacao_id integer NOT NULL,
    nome text NOT NULL,
    slug text NOT NULL,
    ordem integer NOT NULL,
    finalizado boolean DEFAULT false
);

CREATE TABLE public.permissoes (
    id bigint NOT NULL,
    funcao_id bigint NOT NULL,
    recurso text NOT NULL,
    pode_ver boolean DEFAULT false,
    pode_criar boolean DEFAULT false,
    pode_editar boolean DEFAULT false,
    pode_excluir boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.politicas_plataforma (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    tipo text NOT NULL,
    versao text NOT NULL,
    titulo text,
    conteudo text,
    data_publicacao timestamp with time zone DEFAULT timezone('utc'::text, now()),
    is_active boolean DEFAULT false
);

CREATE TABLE public.pontos (
    id bigint NOT NULL,
    funcionario_id bigint NOT NULL,
    data_hora timestamp without time zone NOT NULL,
    tipo_registro text,
    observacao text,
    created_at timestamp without time zone DEFAULT now(),
    abonado boolean DEFAULT false,
    motivo_abono text,
    editado_manualmente boolean DEFAULT false,
    editado_por_usuario_id uuid,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.produtos_empreendimento (
    id bigint NOT NULL,
    empreendimento_id bigint NOT NULL,
    tipo text,
    unidade text,
    area_m2 numeric,
    valor_base numeric,
    fator_reajuste_percentual numeric,
    valor_venda_calculado numeric,
    status text DEFAULT 'Disponível'::text,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL,
    matricula text,
    preco_m2 numeric
);

CREATE TABLE public.projetos_bim (
    id bigint NOT NULL,
    nome_arquivo text NOT NULL,
    tamanho_bytes bigint,
    urn_autodesk text,
    caminho_storage text,
    status text DEFAULT 'Pendente'::text,
    criado_por uuid DEFAULT auth.uid(),
    criado_em timestamp with time zone DEFAULT now(),
    empreendimento_id bigint,
    empresa_id bigint,
    disciplina_id bigint,
    versao integer DEFAULT 1,
    descricao text,
    organizacao_id bigint,
    is_lixeira boolean DEFAULT false,
    atualizado_em timestamp with time zone DEFAULT now()
);

CREATE TABLE public.rdo_fotos_uploads (
    id bigint NOT NULL,
    diario_obra_id bigint NOT NULL,
    caminho_arquivo text NOT NULL,
    descricao text,
    created_at timestamp with time zone DEFAULT now(),
    tamanho_arquivo integer,
    organizacao_id bigint
);

CREATE TABLE public.regras_roteamento_funil (
    id bigint NOT NULL DEFAULT nextval('regras_roteamento_funil_id_seq'::regclass),
    organizacao_id bigint NOT NULL,
    nome text NOT NULL DEFAULT 'Regra sem nome'::text,
    campaign_id text,
    ad_id text,
    page_id text,
    funil_destino_id text NOT NULL,
    ativo boolean NOT NULL DEFAULT true,
    ordem integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.saldos_diarios_ponto (
    funcionario_id bigint,
    data date,
    minutos_trabalhados numeric,
    minutos_previstos numeric,
    saldo_minutos_dia numeric
);

CREATE TABLE public.simulacoes (
    id bigint NOT NULL,
    contato_id bigint NOT NULL,
    empreendimento_id bigint NOT NULL,
    usuario_id uuid,
    status text NOT NULL DEFAULT 'Em negociação'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    valor_venda numeric,
    desconto_percentual numeric DEFAULT 0,
    desconto_valor numeric DEFAULT 0,
    entrada_percentual numeric DEFAULT 0,
    entrada_valor numeric DEFAULT 0,
    num_parcelas_entrada integer DEFAULT 1,
    data_primeira_parcela_entrada date,
    parcelas_obra_percentual numeric DEFAULT 0,
    parcelas_obra_valor numeric DEFAULT 0,
    num_parcelas_obra integer DEFAULT 1,
    data_primeira_parcela_obra date,
    saldo_remanescente_percentual numeric DEFAULT 0,
    saldo_remanescente_valor numeric DEFAULT 0,
    produto_id bigint,
    contrato_id bigint,
    corretor_id bigint,
    plano_proposta jsonb,
    produtos_proposta jsonb,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.sinapi (
    id bigint NOT NULL,
    empresa_fornecedor_id bigint,
    nome text,
    descricao text,
    unidade_medida text,
    preco_unitario numeric,
    Grupo text,
    Código da Composição text,
    Origem text,
    classificacao text NOT NULL DEFAULT 'Insumo'::text,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.sistema_biblioteca_funcoes (
    id bigint,
    schema name,
    nome_funcao name,
    tipo text,
    codigo_fonte text,
    data_visualizacao timestamp with time zone
);

CREATE TABLE public.subetapas (
    id bigint NOT NULL,
    nome_subetapa text NOT NULL,
    codigo_subetapa text,
    etapa_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.sys_chat_broadcast_lists (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organizacao_id bigint NOT NULL,
    owner_id uuid NOT NULL,
    nome text NOT NULL,
    membros_ids ARRAY NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.sys_chat_conversations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organizacao_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.sys_chat_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid,
    sender_id uuid NOT NULL,
    conteudo text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    read_at timestamp with time zone
);

CREATE TABLE public.sys_chat_mural_comments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL,
    author_id uuid NOT NULL,
    conteudo text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.sys_chat_mural_likes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.sys_chat_mural_posts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organizacao_id bigint NOT NULL,
    author_id uuid NOT NULL,
    assunto text NOT NULL,
    conteudo text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.sys_chat_participants (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.sys_notification_templates (
    id bigint NOT NULL,
    nome_regra text NOT NULL,
    tabela_alvo text NOT NULL,
    evento text NOT NULL,
    coluna_monitorada text,
    valor_gatilho text,
    enviar_para_dono boolean DEFAULT false,
    titulo_template text NOT NULL,
    mensagem_template text NOT NULL,
    link_template text,
    organizacao_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    icone text DEFAULT 'fa-bell'::text,
    regras_avancadas jsonb
);

CREATE TABLE public.sys_org_notification_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organizacao_id bigint NOT NULL,
    template_id bigint NOT NULL,
    is_active boolean DEFAULT false,
    funcoes_ids ARRAY DEFAULT '{}'::bigint[],
    enviar_push boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.sys_user_notification_prefs (
    id bigint NOT NULL,
    usuario_id uuid NOT NULL,
    template_id bigint NOT NULL,
    canal_sistema boolean NOT NULL DEFAULT true,
    canal_push boolean NOT NULL DEFAULT true,
    organizacao_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.tabelas_sistema (
    id bigint NOT NULL,
    nome_tabela text NOT NULL,
    nome_exibicao text NOT NULL,
    modulo text DEFAULT 'Geral'::text,
    icone text DEFAULT 'fa-table'::text,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.telefones (
    id bigint NOT NULL,
    contato_id bigint NOT NULL,
    telefone text NOT NULL,
    tipo text,
    created_at timestamp with time zone DEFAULT now(),
    country_code character varying(10) DEFAULT '+55'::character varying,
    organizacao_id bigint
);

CREATE TABLE public.telefones_backup_faxina (
    id bigint,
    contato_id bigint,
    telefone text,
    tipo text,
    created_at timestamp with time zone,
    country_code character varying(10),
    organizacao_id bigint
);

CREATE TABLE public.termos_aceite (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    termo_id bigint NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.termos_uso (
    id bigint NOT NULL,
    tipo text NOT NULL DEFAULT 'CORRETOR'::text,
    conteudo text NOT NULL,
    versao integer NOT NULL,
    ativo boolean DEFAULT true,
    organizacao_id bigint,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.usuario_aceite_politicas (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    usuario_id uuid NOT NULL,
    organizacao_id bigint,
    politica_id uuid NOT NULL,
    tipo text NOT NULL,
    versao text NOT NULL,
    data_aceite timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.usuarios (
    id uuid NOT NULL,
    funcionario_id bigint,
    email text,
    nome text,
    sobrenome text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    funcao_id bigint,
    avatar_url text,
    aceitou_termos boolean DEFAULT false,
    sidebar_position text NOT NULL DEFAULT 'left'::text,
    organizacao_id bigint NOT NULL,
    cotacoes_visiveis jsonb NOT NULL DEFAULT '[]'::jsonb,
    mostrar_barra_cotacoes boolean NOT NULL DEFAULT true,
    preferencias_notificacao jsonb DEFAULT '{"sistema": true, "comercial": true, "financeiro": true, "operacional": true}'::jsonb,
    data_exclusao timestamp with time zone,
    ultimo_acesso timestamp with time zone,
    is_superadmin boolean DEFAULT false
);

CREATE TABLE public.vales_agendados (
    id bigint NOT NULL,
    funcionario_id bigint NOT NULL,
    lancamento_id bigint NOT NULL,
    periodo_inicio date NOT NULL,
    periodo_fim date NOT NULL,
    data_pagamento_agendada date NOT NULL,
    valor_projetado numeric NOT NULL,
    valor_final_ajustado numeric,
    status text NOT NULL DEFAULT 'Agendado'::text,
    criado_em timestamp with time zone DEFAULT now(),
    processado_em timestamp with time zone,
    organizacao_id bigint NOT NULL
);

CREATE TABLE public.variaveis_virtuais (
    id bigint NOT NULL,
    tabela_gatilho text NOT NULL,
    nome_variavel text NOT NULL,
    coluna_origem text NOT NULL,
    tabela_destino text NOT NULL,
    coluna_chave_destino text DEFAULT 'id'::text,
    coluna_retorno text NOT NULL,
    organizacao_id bigint,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.whatsapp_broadcast_lists (
    id bigint NOT NULL,
    nome text NOT NULL,
    descricao text,
    filtros_usados jsonb,
    criado_por uuid,
    organizacao_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_dynamic boolean DEFAULT false
);

CREATE TABLE public.whatsapp_conversations (
    id bigint NOT NULL,
    phone_number text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    contato_id bigint,
    is_archived boolean DEFAULT false,
    organizacao_id bigint,
    last_message_id bigint,
    unread_count integer DEFAULT 0,
    last_direction text DEFAULT 'inbound'::text,
    last_status text DEFAULT 'delivered'::text,
    last_message_direction text DEFAULT 'inbound'::text,
    customer_window_start_at timestamp with time zone
);

CREATE TABLE public.whatsapp_list_members (
    id bigint NOT NULL,
    lista_id bigint NOT NULL,
    contato_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    organizacao_id bigint
);

CREATE TABLE public.whatsapp_messages (
    id bigint NOT NULL,
    contato_id bigint,
    enterprise_id bigint,
    message_id text,
    conversation_id text,
    sender_id text,
    receiver_id text,
    content text,
    sent_at timestamp with time zone,
    direction text,
    status text,
    raw_payload jsonb,
    created_at timestamp with time zone DEFAULT now(),
    is_read boolean NOT NULL DEFAULT false,
    organizacao_id bigint,
    conversation_record_id bigint,
    media_url text,
    broadcast_id bigint,
    nome_remetente text,
    error_message text,
    reaction_data jsonb
);

CREATE TABLE public.whatsapp_scheduled_broadcasts (
    id bigint NOT NULL,
    lista_id bigint NOT NULL,
    template_name text NOT NULL,
    language text NOT NULL,
    variables jsonb,
    full_text_base text,
    components jsonb,
    scheduled_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text,
    organizacao_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    total_contacts integer DEFAULT 0,
    processed_count integer DEFAULT 0,
    success_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    started_at timestamp with time zone,
    stopped_at timestamp with time zone
);

CREATE TABLE public.whatsapp_webhook_logs (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    log_level text,
    message text,
    payload jsonb,
    organizacao_id bigint
);
