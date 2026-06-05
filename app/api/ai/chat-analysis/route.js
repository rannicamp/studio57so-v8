import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Instância do SDK do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request) {
  try {
    const { contato_id, organizacao_id, force } = await request.json();

    if (!contato_id || !organizacao_id) {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios.' }, { status: 400 });
    }

    // Cliente com permissões de administrador (bypass RLS se necessário, ou atua sobre tudo da organização)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Tentar ler do Cache se não foi forçado a atualizar
    if (!force) {
      const { data: contactCache } = await supabaseAdmin
        .from('contatos')
        .select('ai_analysis')
        .eq('id', contato_id)
        .single();
        
      if (contactCache?.ai_analysis) {
        return NextResponse.json(contactCache.ai_analysis);
      }
    }

    if (!process.env.GEMINI_API_KEY) {
       return NextResponse.json({ error: 'Chave GEMINI_API_KEY não configurada no servidor.' }, { status: 500 });
    }

    // 1.5 Buscar Dados Cadastrais e de Origem (Meta Ads / CRM) do Contato
    const { data: contatoInfo, error: contatoError } = await supabaseAdmin
      .from('contatos')
      .select(`
        nome,
        cpf,
        cnpj,
        origem,
        objetivo,
        cargo,
        estado_civil,
        renda_familiar,
        fgts,
        mais_de_3_anos_clt,
        observations,
        meta_campaign_name,
        meta_adset_name,
        meta_ad_name,
        meta_form_data,
        birth_date,
        cep,
        address_street,
        address_number,
        address_complement,
        neighborhood,
        city,
        state,
        anuncio:meta_ad_id(id, nome),
        adset:meta_adset_id(id, nome),
        campanha:meta_campaign_id(id, nome)
      `)
      .eq('id', contato_id)
      .eq('organizacao_id', organizacao_id)
      .single();

    if (contatoError) {
      console.error('Erro ao buscar dados do contato para IA:', contatoError);
    }

    // Resolve os nomes com fallback: coluna _name → JOIN meta_ativos
    if (contatoInfo) {
      contatoInfo.meta_ad_name_original = contatoInfo.meta_ad_name;
      contatoInfo.meta_adset_name_original = contatoInfo.meta_adset_name;
      contatoInfo.meta_campaign_name_original = contatoInfo.meta_campaign_name;

      contatoInfo.meta_ad_name = contatoInfo.meta_ad_name || contatoInfo.anuncio?.nome || null;
      contatoInfo.meta_adset_name = contatoInfo.meta_adset_name || contatoInfo.adset?.nome || null;
      contatoInfo.meta_campaign_name = contatoInfo.meta_campaign_name || contatoInfo.campanha?.nome || null;
    }

    // 1.8 Buscar a mensagem mais recente enviada pelo cliente (inbound)
    const { data: ultimaMsgCliente } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('id, media_url, content, raw_payload, created_at')
      .eq('contato_id', contato_id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let docBase64Data = null;
    let docMimeType = null;

    // Apenas processamos a mídia se ela for de fato a última mensagem recebida do cliente e recente (enviada nos últimos 5 minutos)
    if (ultimaMsgCliente && ultimaMsgCliente.media_url) {
      const diferencaTempo = Date.now() - new Date(ultimaMsgCliente.created_at).getTime();
      const ehRecente = diferencaTempo < 5 * 60 * 1000; // 5 minutos

      if (ehRecente) {
        const urlLower = ultimaMsgCliente.media_url.toLowerCase();
        // Consideramos PDF ou imagens comuns de documentos
        const isPdf = urlLower.includes('.pdf') || (ultimaMsgCliente.raw_payload && ultimaMsgCliente.raw_payload.type === 'document');
        const isImg = urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || urlLower.includes('.webp') || (ultimaMsgCliente.raw_payload && ultimaMsgCliente.raw_payload.type === 'image');

        if (isPdf || isImg) {
          console.log(`[Stella AI] Mídia recente detectada para análise online: ${ultimaMsgCliente.media_url}`);
          try {
            const fileResponse = await fetch(ultimaMsgCliente.media_url);
            if (fileResponse.ok) {
              const arrayBuffer = await fileResponse.arrayBuffer();
              docBase64Data = Buffer.from(arrayBuffer).toString('base64');
              docMimeType = isPdf ? 'application/pdf' : fileResponse.headers.get('content-type') || 'image/jpeg';
              console.log(`[Stella AI] Mídia carregada com sucesso na memória RAM (Tamanho: ${docBase64Data.length} caracteres Base64).`);
            }
          } catch (mediaErr) {
            console.error('[Stella AI Warning] Erro ao baixar mídia para memória RAM:', mediaErr.message);
          }
        }
      } else {
        console.log(`[Stella AI] Mídia mais recente (${ultimaMsgCliente.media_url}) foi enviada há mais de 5 minutos. Ignorando download para otimização de performance.`);
      }
    }

    // 2. Coletar Histórico do WhatsApp
    const { data: messages } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('content, direction, sent_at')
      .eq('contato_id', contato_id)
      .eq('organizacao_id', organizacao_id)
      .order('sent_at', { ascending: false }) // Pega os mais recentes
      .limit(100);


    // 3. Coletar Dados do Funil Comercial
    const { data: funil } = await supabaseAdmin
      .from('contatos_no_funil')
      .select(`
        id,
        colunas_funil(nome),
        contatos_no_funil_produtos(
          produto:produto_id(nome, empreendimento_id, area_m2, valor_venda_calculado)
        )
      `)
      .eq('contato_id', contato_id)
      .maybeSingle();

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        resumo_interacao: "Não há mensagens suficientes no WhatsApp para análise.",
        temperatura: "Frio",
        fase_crm_atual: funil?.colunas_funil?.nome || "Nenhuma fase no funil",
        proxima_acao_sugerida: "Inicie o contato com o cliente via WhatsApp.",
        proxima_resposta_sugerida: "Olá! Notei seu interesse, como posso ajudar?"
      });
    }

    // Invertemos para ficar na ordem cronológica de leitura da IA (começo -> fim)
    const reversedMessages = messages.reverse();

    // Formata o histórico como string
    const chatLog = reversedMessages.filter(m => m.content).map(m => {
      const actor = m.direction === 'inbound' ? 'Cliente' : 'Corretor';
      return `[${new Date(m.sent_at).toLocaleString('pt-BR')}] ${actor}: ${m.content}`;
    }).join('\n');

    const crmStatus = funil?.colunas_funil?.nome || "Lead Sem Funil (Caixa de Entrada Vazia)";
    const produtosRaw = funil?.contatos_no_funil_produtos?.map(p => p.produto?.nome) || [];
    const produtos = produtosRaw.length > 0 ? produtosRaw.join(', ') : "Nenhum Produto Vinculado";

    // Extrair IDs de Empreendimentos para buscar anexos e contexto
    const empIdsSet = new Set();
    let detalhesUnidades = "";
    if (funil?.contatos_no_funil_produtos) {
      funil.contatos_no_funil_produtos.forEach(p => {
        if (p.produto?.empreendimento_id) empIdsSet.add(p.produto.empreendimento_id);
        if (p.produto?.nome) {
          detalhesUnidades += `- Produto: ${p.produto.nome} | Área: ${p.produto.area_m2 || 'N/A'}m² | Valor Calculado: R$ ${p.produto.valor_venda_calculado || 'N/A'}\n`;
        }
      });
    }

    // Tenta deduzir o empreendimento também pelo texto de campanhas de Ads
    const campaignText = (
      (contatoInfo?.meta_campaign_name || '') + ' ' + 
      (contatoInfo?.meta_adset_name || '') + ' ' + 
      (contatoInfo?.meta_ad_name || '')
    ).toLowerCase();

    if (campaignText.includes('alfa')) {
      empIdsSet.add(1); // Residencial Alfa
    }
    if (campaignText.includes('beta') || campaignText.includes('samara')) {
      empIdsSet.add(5); // Beta Suítes
    }
    if (campaignText.includes('braunas') || campaignText.includes('braúnas')) {
      empIdsSet.add(6); // Refúgio Braúnas
    }

    const empreendimentoIds = Array.from(empIdsSet);

    // Obter BASE DE CONHECIMENTO GLOBAL (Dossiês de Empreendimentos)
    let empContext = "";
    const { data: todosEmpreendimentos } = await supabaseAdmin
      .from('empreendimentos')
      .select('nome, dossie_ia')
      .not('dossie_ia', 'is', null);

    if (todosEmpreendimentos && todosEmpreendimentos.length > 0) {
      empContext = "### BASE DE CONHECIMENTO GLOBAL (Cérebro da Studio 57)\n" + todosEmpreendimentos.map(e => {
        return `\n--- INÍCIO DO DOSSIÊ: ${e.nome} ---\n${e.dossie_ia}\n--- FIM DO DOSSIÊ: ${e.nome} ---\n`;
      }).join('\n');
    }

    // Busca de anexos disponíveis
    let anexosContext = "Nenhum anexo público encontrado.";
    let queryAnexos = supabaseAdmin
      .from('empreendimento_anexos')
      .select('id, nome_arquivo, caminho_arquivo, descricao')
      .eq('disponivel_corretor', true) // Apenas o que estiver compartilhado com corretores
      .eq('organizacao_id', organizacao_id);

    const { data: anexos } = await queryAnexos;
    if (anexos && anexos.length > 0) {
       anexosContext = anexos.map(a => `- ID: ${a.id} | Nome: "${a.nome_arquivo}" | Caminho: "${a.caminho_arquivo}" | Descrição: "${a.descricao || 'Sem descrição'}"`).join('\n');
    }

    // --- NOVA BUSCA DE PRODUTOS DISPONÍVEIS (ESTOQUE REAL) ---
    const empIdsBusca = empreendimentoIds.length > 0 ? empreendimentoIds : [1, 5, 6];
    const { data: produtosDisponiveis, error: prodErr } = await supabaseAdmin
      .from('produtos_empreendimento')
      .select('id, unidade, area_m2, valor_venda_calculado, status, descricao, empreendimento_id')
      .in('empreendimento_id', empIdsBusca)
      .eq('status', 'Disponível')
      .eq('organizacao_id', organizacao_id);

    if (prodErr) {
      console.error('Erro ao buscar produtos disponíveis para a Stella:', prodErr);
    }

    // Filtra apenas unidades residenciais reais, ignorando garagens e motos para o estoque de apartamentos
    const unidadesHabitacionais = (produtosDisponiveis || []).filter(p => {
      const u = (p.unidade || '').toUpperCase();
      return !u.includes('MOTO') && !u.includes('CARRO') && !u.includes('GARAGEM');
    });

    let produtosDisponiveisContext = "Nenhuma unidade habitacional disponível cadastrada em estoque no momento.";
    if (unidadesHabitacionais.length > 0) {
      produtosDisponiveisContext = unidadesHabitacionais.map(p => 
        `- Empreendimento ID: ${p.empreendimento_id} | Unidade: ${p.unidade} | Área: ${p.area_m2}m² | Valor de Venda: R$ ${p.valor_venda_calculado} | Descrição: ${p.descricao || 'Sem descrição'}`
      ).join('\n');
    }

    // Formata o formulário da Meta de forma legível
    let metaFormString = "Nenhum formulário de lead respondido.";
    if (contatoInfo?.meta_form_data) {
      try {
        const formData = typeof contatoInfo.meta_form_data === 'string' 
          ? JSON.parse(contatoInfo.meta_form_data) 
          : contatoInfo.meta_form_data;
        
        if (Array.isArray(formData)) {
          metaFormString = formData.map(f => `- Pergunta: ${f.name || f.question} | Resposta: ${f.value || f.response}`).join('\n');
        } else if (typeof formData === 'object') {
          metaFormString = Object.entries(formData).map(([key, val]) => `- ${key}: ${val}`).join('\n');
        }
      } catch (e) {
        metaFormString = JSON.stringify(contatoInfo.meta_form_data);
      }
    }

    const fichaLead = `
### FICHA CADASTRAL E DADOS DE ORIGEM (CRM e Facebook/Meta Ads)
- Nome cadastrado: ${contatoInfo?.nome || 'Não informado'}
- Origem declarada: ${contatoInfo?.origem || 'Não informada'}
- Objetivo cadastrado no CRM: ${contatoInfo?.objetivo || 'Não informado (Precisa ser detectado)'}
- Observações no CRM: ${contatoInfo?.observations || 'Nenhuma observação cadastrada'}
- Renda familiar cadastrada: ${contatoInfo?.renda_familiar ? `R$ ${contatoInfo.renda_familiar}` : 'Não cadastrada'}
- FGTS cadastrado: ${contatoInfo?.fgts ? 'Sim' : 'Não informado'}
- Tempo de CLT cadastrado: ${contatoInfo?.mais_de_3_anos_clt ? 'Mais de 3 anos' : 'Não informado'}
- Estado Civil cadastrado: ${contatoInfo?.estado_civil || 'Não informado'}
- Profissão/Cargo cadastrado: ${contatoInfo?.cargo || 'Não informado'}

### ORIGEM DO META ADS (FACEBOOK/INSTAGRAM CAMPANHAS)
- Campanha do anúncio: ${contatoInfo?.meta_campaign_name || 'Nenhuma campanha associada'}
- Conjunto de anúncios (Adset): ${contatoInfo?.meta_adset_name || 'Nenhum conjunto associado'}
- Nome do anúncio: ${contatoInfo?.meta_ad_name || 'Nenhum anúncio associado'}
- Respostas do Formulário de Lead da Meta (Perguntas/Respostas respondidas no anúncio):
${metaFormString}
    `;

    // 4. Invocar a IA 
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-pro-preview',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
Você é Stella, a super Analista Comercial de Elite e Assistente Copiloto da Studio 57.
Graduada em inteligência de leads, sua missão é classificar o lead, analisar a origem da campanha e o perfil do cliente, e gerar uma RESPOSTA SUGERIDA PRONTA para o corretor copiar e enviar ao cliente (ou que será disparada automaticamente no piloto automático).

# Instrução Crítica de Contexto (Origem do Lead e Histórico)
A PRIMEIRA coisa que você deve fazer é analisar as informações da "FICHA CADASTRAL E DADOS DE ORIGEM" e as campanhas do Facebook/Meta Ads de onde ele veio. 
Cruze esses dados com o "Histórico da Conversa" recente no WhatsApp. O histórico da conversa dita a regra final de interesse atual do cliente.

# Regras de Inteligência de Estoque (Produtos, Andares e Simulações)
1. Analise atentamente o "Histórico Recente de Conversa". Se o cliente solicitar ou expressar preferência por andares/posições (ex: "mais alto", "último andar", "andar do topo", "mais baixo", "primeiros andares"), busque na lista de "# Lista de Unidades Disponíveis em Estoque (Real)" as unidades correspondentes ao empreendimento detectado.
2. Para edifícios verticais (Alfa = ID 1, Beta = ID 5):
   - O andar é representado pelos primeiros dígitos da unidade (ex: "705" é 7º andar, "503" é 5º andar, "303" é 3º andar, "203" é 2º andar).
   - Unidades com numeração maior (ex: 705 vs 303) representam andares mais altos.
   - Escolha a melhor unidade disponível que atende à solicitação: se ele quer a mais alta, selecione a de número mais alto disponível (ex: 705); se quer a mais baixa, selecione a de número mais baixo disponível (ex: 201 ou 202).
3. Quando apresentar uma unidade habitacional para o cliente, faça de forma proativa o cálculo exato da **Simulação de Pagamento Padrão** baseado no valor total da unidade selecionada:
   - **Valor Total de Venda**: O 'Valor de Venda' da unidade disponível no estoque real.
   - **Entrada / Sinal (20%)**: Calcule 20% do valor da unidade.
   - **Fluxo de Mensais Obra (40%)**: Calcule 40% do valor da unidade e divida por **42 parcelas mensais** (ou por 36 se for o Residencial Alfa, conforme seu dossiê).
     - *Fórmula*: (Valor da Unidade * 0.40) / 42.
   - **Remanescente / Saldo de Chaves (40%)**: Calcule 40% do valor da unidade (a ser pago no pós-habite-se via quitação ou financiamento bancário).
4. Formate a resposta sugerida detalhando a unidade e a simulação de pagamento de maneira organizada e super legível (com marcadores), por exemplo:
   "No último andar temos disponível a unidade 705 (R$ 269.406). As condições são super facilitadas:
   - Entrada (20%): R$ 53.881
   - 42 mensais de: R$ 2.565
   - Saldo nas chaves (remanescente): R$ 107.762"
5. Se o cliente perguntar algo sobre a localização, áreas de lazer ou detalhes do projeto, busque essas informações no "Dossiê do Empreendimento" correspondente.

# Regras de Terminologia e Vendas (Crítico)
- PROIBIÇÃO DE TERMO COMERCIAL: É TERMINANTEMENTE PROIBIDO usar o termo "hiper-compacto", "hipercompacto", "compacto" ou "studios hiper-compactos". Em vez disso, use sempre termos como "otimizado", "studio otimizado", "planta inteligente" ou "planta otimizada".

# Fluxo de Diálogo para Cadastro e Coleta de Endereço (CEP, Número e Complemento)
1. Para o cadastro do cliente e elaboração do contrato de reserva, o sistema exige o endereço completo. O sistema busca o endereço automaticamente se o CEP for fornecido.
2. Analise os "Dados Cadastrais do Contato" para verificar se o endereço está completo. O endereço é considerado incompleto se o campo "cep" estiver em branco ou se faltar o "address_number" (número da casa/prédio).
3. Se o endereço estiver incompleto na Ficha do Lead:
   - Peça ativamente o endereço completo do cliente de forma amigável.
   - Solicite que ele envie o comprovante de residência (seja em formato PDF ou uma foto/imagem legível do documento, como conta de água, energia, telefone).
   - Explique que, se ele preferir, pode simplesmente digitar o CEP, o número e o complemento diretamente por mensagem de texto no chat.
4. Se o cliente enviar o CEP (por texto ou se for lido no documento comprovante):
   - Priorize extrair o CEP, o número da residência (no campo "address_number") e o complemento (no campo "address_complement") no objeto "dados_cliente". Como o sistema busca o endereço automaticamente a partir do CEP, esses são os campos mais críticos para o cadastro. No entanto, se o endereço completo for fornecido (rua, bairro, cidade, estado), extraia também esses campos para garantir que a ficha cadastral fique o mais completa possível.
5. Se uma mídia do tipo documento (PDF) ou imagem (foto) for enviada pelo cliente, e corresponder a um comprovante de residência, analise o documento visualmente e extraia o CEP, Logradouro, Número, Complemento, Bairro, Cidade e Estado para preencher o cadastro.

# Ficha Cadastral e Origem do Lead
${fichaLead}

# Dados Atuais do CRM
- Fase no Funil (CRM): ${crmStatus}
- Unidades/Produtos Interessados: ${produtos}

### BASE DE CONHECIMENTO GLOBAL (Cérebro da Studio 57)
${empContext}

# Inteligência de Produtos CRM
${detalhesUnidades}

# Lista de Unidades Disponíveis em Estoque (Real)
${produtosDisponiveisContext}

# Arquivos e Anexos Disponíveis para Envio
${anexosContext}

# Histórico Recente de Conversa (WhatsApp)
${chatLog}

# Regras de Extração e Análise do Cliente (Chave "dados_cliente" e ID do Empreendimento)
Analise todos os dados disponíveis (Ficha do Lead, Origem do Meta Ads, Formulário Meta, Dossiês e Conversa no WhatsApp) para determinar o perfil do cliente:
1. "objetivo": Classifique rigorosamente como "MORADIA", "INVESTIMENTO" ou "LAZER".
   - O histórico de conversa no WhatsApp (chat log) é a verdade final absoluta e prevalece sobre as campanhas. Se o lead veio de uma campanha do Beta Suítes (Investimento) mas no chat ele diz que pretende morar com a família no apartamento, classifique como "MORADIA".
   - Caso seja inconclusivo e não haja nenhuma informação, retorne null.
2. Identifique qual é o ID numérico do Empreendimento associado ao interesse do lead no campo "empreendimento_detectado_id":
   - 1 para Residencial Alfa.
   - 5 para Beta Suítes.
   - 6 para Refúgio Braúnas.
   - Se for outro empreendimento ou totalmente inconclusivo, retorne null.
3. Outros campos cadastrais do lead: "nome", "cpf", "cnpj", "renda_familiar", "fgts", "mais_de_3_anos_clt", "cargo", "estado_civil", "birth_date" e endereço.

Com base SOMENTE neste histórico recente e contexto do projeto, escreva um JSON rigoroso nos seguintes moldes:
{
  "resumo_interacao": "Texto conciso de até 3 linhas resumindo a intenção real, de onde o lead veio (campanha) e o ponto de temperatura da conversa.",
  "temperatura": "Quente" ou "Morno" ou "Frio",
  "fase_crm_atual": "${crmStatus}",
  "proxima_acao_sugerida": "Dica direta e acionável para o corretor.",
  "proxima_resposta_sugerida": "A resposta exata e natural para enviar ao cliente. REGRA DE OURO WHATSAPP: Seja EXTREMAMENTE SUCINTO. Envie frases curtas, dinâmicas e amigáveis. Use parágrafos curtíssimos (separados por \\n\\n), tom de conversa super humano e direto ao ponto. Termine sempre com uma única pergunta curta para engajar. Se incluir uma simulação de pagamento, estruture-a de forma clara com bullet points, mas mantenha o texto em volta muito objetivo.",
  "empreendimento_detectado_id": 1, 5, 6 ou null,
  "anexo_sugerido": {
    "id": ID_DO_ARQUIVO,
    "nome_arquivo": "NOME_DO_ARQUIVO_EXATO (idêntico ao da lista)",
    "caminho_arquivo": "CAMINHO_DO_ARQUIVO_EXATO (idêntico ao da lista)"
  },
  "dados_cliente": {
    "nome": "Nome completo ou null",
    "cpf": "Apenas dígitos do CPF ou null",
    "cnpj": "Apenas dígitos do CNPJ ou null",
    "rg": "Apenas dígitos do RG ou null",
    "nacionalidade": "Nacionalidade ou null",
    "renda_familiar": 12000.00 (ou null),
    "fgts": true/false (ou null),
    "mais_de_3_anos_clt": true/false (ou null),
    "objetivo": "MORADIA" / "INVESTIMENTO" / "LAZER" (ou null),
    "cargo": "Profissão ou null",
    "estado_civil": "Estado civil ou null",
    "birth_date": "YYYY-MM-DD ou null",
    "cep": "Apenas dígitos do CEP ou null",
    "address_street": "Logradouro ou null",
    "address_number": "Número ou null",
    "address_complement": "Complemento ou null",
    "neighborhood": "Bairro ou null",
    "city": "Cidade ou null",
    "state": "UF ou null"
  }
}
`;

    const promptContent = [];
    if (docBase64Data && docMimeType) {
      console.log(`[Stella AI] Injetando arquivo CNH/Documento de forma online no prompt do Gemini...`);
      promptContent.push({
        inlineData: {
          data: docBase64Data,
          mimeType: docMimeType
        }
      });
    }
    promptContent.push({ text: prompt });

    const result = await model.generateContent(promptContent);
    const textOutput = result.response.text();
    
    let parsedResult;
    try {
      // Limpeza de blocos de marcação, caso a API teimosamente os envie
      const cleanString = textOutput.replace(/```json/gi, '').replace(/```/gi, '').trim();
      let rawJson = JSON.parse(cleanString);
      
      if (Array.isArray(rawJson)) {
        parsedResult = rawJson[0] || {};
      } else {
        parsedResult = rawJson;
      }
      
      // Adiciona o timestamp da análise
      parsedResult.last_updated = new Date().toISOString();
    } catch (e) {
      console.error('[AI Parser Error]', textOutput, e);
      return NextResponse.json({ error: 'Falha ao processar o JSON retornado pela IA' }, { status: 500 });
    }

    // --- NOVA LÓGICA: ATUALIZAÇÃO CADASTRAL INTELIGENTE E INCREMENTAL ---
    if (parsedResult.dados_cliente && typeof parsedResult.dados_cliente === 'object') {
      const dc = parsedResult.dados_cliente;
      const currentContact = contatoInfo;
      
      if (currentContact) {
        const updateData = {};

        // Regra do Nome Completo: atualiza apenas se o nome detectado tiver mais palavras e contiver o atual
        if (dc.nome && typeof dc.nome === 'string' && dc.nome.trim().length > 0) {
          const nomeDetectado = dc.nome.trim();
          const nomeAtual = (currentContact.nome || '').trim();
          const palavrasNovas = nomeDetectado.split(/\s+/).length;
          const palavrasAtuais = nomeAtual.split(/\s+/).length;

          if (nomeAtual === '' || (palavrasNovas > palavrasAtuais && nomeDetectado.toLowerCase().includes(nomeAtual.split(/\s+/)[0].toLowerCase()))) {
            updateData.nome = nomeDetectado;
          }
        }

        // Se as colunas textuais na tabela contatos estiverem nulas no banco e resolvidas pelo JOIN,
        // salvamos para persistir na ficha do contato permanentemente.
        if (!currentContact.meta_campaign_name_original && currentContact.meta_campaign_name) {
          updateData.meta_campaign_name = currentContact.meta_campaign_name;
        }
        if (!currentContact.meta_adset_name_original && currentContact.meta_adset_name) {
          updateData.meta_adset_name = currentContact.meta_adset_name;
        }
        if (!currentContact.meta_ad_name_original && currentContact.meta_ad_name) {
          updateData.meta_ad_name = currentContact.meta_ad_name;
        }

        // Função auxiliar para atualizar apenas se estiver vazio/nulo (campos críticos de identidade)
        const preencherSeVazio = (field, value) => {
          const currentValue = currentContact[field];
          if (value !== undefined && value !== null && (currentValue === null || currentValue === undefined || String(currentValue).trim() === '')) {
            updateData[field] = value;
          }
        };

        // Função auxiliar para atualizar se houver qualquer alteração/diferença (campos gerais de cadastro)
        const atualizarSeDiferente = (field, value) => {
          if (value !== undefined && value !== null && String(value).trim() !== '') {
            const currentValue = currentContact[field];
            if (currentValue === null || currentValue === undefined || String(currentValue).trim().toLowerCase() !== String(value).trim().toLowerCase()) {
              updateData[field] = value;
            }
          }
        };

        // Campos de identificação rígidos: só preenchemos se estiver em branco
        preencherSeVazio('cpf', dc.cpf);
        preencherSeVazio('cnpj', dc.cnpj);
        preencherSeVazio('renda_familiar', dc.renda_familiar);

        // Campos gerais e de endereço: atualizamos incrementalmente caso a IA detecte novidades ou alterações
        atualizarSeDiferente('estado_civil', dc.estado_civil);
        atualizarSeDiferente('cargo', dc.cargo);
        atualizarSeDiferente('rg', dc.rg);
        atualizarSeDiferente('nacionalidade', dc.nacionalidade);
        atualizarSeDiferente('fgts', dc.fgts);
        atualizarSeDiferente('mais_de_3_anos_clt', dc.mais_de_3_anos_clt);
        atualizarSeDiferente('cep', dc.cep);
        atualizarSeDiferente('address_street', dc.address_street);
        atualizarSeDiferente('address_number', dc.address_number);
        atualizarSeDiferente('address_complement', dc.address_complement);
        atualizarSeDiferente('neighborhood', dc.neighborhood);
        atualizarSeDiferente('city', dc.city);
        atualizarSeDiferente('state', dc.state);
        atualizarSeDiferente('birth_date', dc.birth_date);


        // Normalização e atualização inteligente do Objetivo
        const objetivoAtual = (currentContact.objetivo || '').trim().toLowerCase();
        if (dc.objetivo && typeof dc.objetivo === 'string') {
          const objetivoIA = dc.objetivo.trim().toUpperCase();
          if (['MORADIA', 'INVESTIMENTO', 'LAZER'].includes(objetivoIA)) {
            // Se estiver vazio, nulo, ou for uma variação antiga (minúscula, com underline, etc)
            if (
              !currentContact.objetivo || 
              objetivoAtual === '' || 
              objetivoAtual === 'não informado' ||
              (objetivoAtual !== objetivoIA.toLowerCase() && !objetivoAtual.startsWith(objetivoIA.toLowerCase().substring(0, 5)))
            ) {
              updateData.objetivo = objetivoIA;
            }
          }
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('contatos')
            .update(updateData)
            .eq('id', contato_id);
            
          if (updateError) {
            console.error('[AI Enrichment] Erro ao atualizar contato:', updateError);
          } else {
            console.log('[AI Enrichment] Contato enriquecido com sucesso:', updateData);
          }
        }
      }
    }

    // 5. Salvar localmente o cache
    await supabaseAdmin
      .from('contatos')
      .update({ ai_analysis: parsedResult })
      .eq('id', contato_id);

    return NextResponse.json(parsedResult);

  } catch (error) {
    console.error('[AI API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
