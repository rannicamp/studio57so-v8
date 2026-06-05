import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Instância do SDK do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request) {
  try {
    const { contato_id, organizacao_id, force, quickResponse } = await request.json();

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

    // 1.5 Buscar os dados iniciais do contato e histórico em paralelo (Otimização de Latência)
    const [
      contatoResult,
      ultimaMsgResult,
      messagesResult,
      funilResult,
      anexosEnviadosResult
    ] = await Promise.all([
      // 1. Dados cadastrais do contato
      supabaseAdmin
        .from('contatos')
        .select(`
          nome, cpf, cnpj, origem, objetivo, cargo, estado_civil, renda_familiar, fgts, mais_de_3_anos_clt,
          observations, meta_campaign_name, meta_adset_name, meta_ad_name, meta_form_data, birth_date, cep,
          address_street, address_number, address_complement, neighborhood, city, state, ai_analysis,
          anuncio:meta_ad_id(id, nome),
          adset:meta_adset_id(id, nome),
          campanha:meta_campaign_id(id, nome)
        `)
        .eq('id', contato_id)
        .eq('organizacao_id', organizacao_id)
        .single(),

      // 2. Última mensagem inbound do cliente
      supabaseAdmin
        .from('whatsapp_messages')
        .select('id, media_url, content, raw_payload, created_at')
        .eq('contato_id', contato_id)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 3. Histórico de mensagens da conversa (limitado a 25 msgs para performance em tempo real)
      supabaseAdmin
        .from('whatsapp_messages')
        .select('content, direction, sent_at')
        .eq('contato_id', contato_id)
        .eq('organizacao_id', organizacao_id)
        .order('sent_at', { ascending: false })
        .limit(25),

      // 4. Dados do Funil Comercial
      supabaseAdmin
        .from('contatos_no_funil')
        .select(`
          id,
          colunas_funil(nome),
          contatos_no_funil_produtos(
            produto:produto_id(nome, empreendimento_id, area_m2, valor_venda_calculado)
          )
        `)
        .eq('contato_id', contato_id)
        .maybeSingle(),

      // 5. Histórico de anexos enviados para este contato (extraído das mensagens outbound com mídia)
      supabaseAdmin
        .from('whatsapp_messages')
        .select('content, media_url')
        .eq('contato_id', contato_id)
        .eq('direction', 'outbound')
        .not('media_url', 'is', null)
    ]);

    const { data: contatoInfo, error: contatoError } = contatoResult;
    const { data: ultimaMsgCliente } = ultimaMsgResult;
    const { data: messages } = messagesResult;
    const { data: funil } = funilResult;
    const { data: anexosEnviados } = anexosEnviadosResult;

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

    let docBase64Data = null;
    let docMimeType = null;

    // Apenas processamos a mídia se ela for de fato a última mensagem recebida do cliente e recente (enviada nos últimos 5 minutos)
    // E apenas no modo completo (se for quickResponse pulamos o download de arquivos pesados)
    if (!quickResponse && ultimaMsgCliente && ultimaMsgCliente.media_url) {
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
    const reversedMessages = [...messages].reverse();

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

    // Tenta deduzir os empreendimentos de interesse pelo histórico de mensagens também
    const chatText = (messages || []).map(m => m.content || '').join(' ').toLowerCase();
    
    if (chatText.includes('alfa')) {
      empIdsSet.add(1); // Residencial Alfa
    }
    if (chatText.includes('beta') || chatText.includes('samara')) {
      empIdsSet.add(5); // Beta Suítes
    }
    if (chatText.includes('braunas') || chatText.includes('braúnas')) {
      empIdsSet.add(6); // Refúgio Braúnas
    }

    const empreendimentoIds = Array.from(empIdsSet);

    // --- NOVA LÓGICA DE QUERIES PARALELAS FILTRADAS POR EMPREENDIMENTO ---
    const empIdsBusca = [1, 5, 6];

    const [
      empreendimentosResult,
      anexosResult,
      produtosResult
    ] = await Promise.all([
      // 1. Dossiês apenas dos empreendimentos de interesse
      supabaseAdmin
        .from('empreendimentos')
        .select('id, nome, dossie_ia')
        .in('id', empIdsBusca)
        .not('dossie_ia', 'is', null),

      // 2. Anexos apenas dos empreendimentos de interesse
      supabaseAdmin
        .from('empreendimento_anexos')
        .select('id, nome_arquivo, caminho_arquivo, descricao, empreendimento_id')
        .eq('disponivel_corretor', true)
        .eq('organizacao_id', organizacao_id)
        .in('empreendimento_id', empIdsBusca),

      // 3. Produtos apenas dos empreendimentos de interesse
      supabaseAdmin
        .from('produtos_empreendimento')
        .select('id, unidade, area_m2, valor_venda_calculado, status, descricao, empreendimento_id')
        .in('empreendimento_id', empIdsBusca)
        .eq('status', 'Disponível')
        .eq('organizacao_id', organizacao_id)
    ]);

    const todosEmpreendimentos = empreendimentosResult.data;
    const anexos = anexosResult.data;
    const produtosDisponiveis = produtosResult.data;

    let empContext = "";
    if (todosEmpreendimentos && todosEmpreendimentos.length > 0) {
      empContext = "### BASE DE CONHECIMENTO DO EMPREENDIMENTO (Dossiê)\n" + todosEmpreendimentos.map(e => {
        return `\n--- INÍCIO DO DOSSIÊ: ${e.nome} ---\n${e.dossie_ia}\n--- FIM DO DOSSIÊ: ${e.nome} ---\n`;
      }).join('\n');
    }

    let anexosContext = "Nenhum anexo público encontrado para este empreendimento.";
    if (anexos && anexos.length > 0) {
       anexosContext = anexos.map(a => `- ID: ${a.id} | Nome: "${a.nome_arquivo}" | Caminho: "${a.caminho_arquivo}" | Descrição: "${a.descricao || 'Sem descrição'}" | Empreendimento ID: ${a.empreendimento_id}`).join('\n');
    }

    let anexosEnviadosContext = "Nenhum anexo foi enviado anteriormente para este cliente nesta conversa.";
    if (anexosEnviados && anexosEnviados.length > 0) {
      anexosEnviadosContext = anexosEnviados.map(ae => `- Nome: "${ae.content || 'Sem nome'}" | URL/Caminho: "${ae.media_url}"`).join('\n');
    }

    // Filtra apenas unidades residenciais reais, ignorando garagens e motos para o estoque de apartamentos
    const unidadesHabitacionais = (produtosDisponiveis || []).filter(p => {
      const u = (p.unidade || '').toUpperCase();
      return !u.includes('MOTO') && !u.includes('CARRO') && !u.includes('GARAGEM');
    });

    let produtosDisponiveisContext = "Nenhuma unidade habitacional disponível cadastrada em estoque no momento para este empreendimento.";
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

    // 4. Invocar a IA (Voltando para gemini-3.1-pro-preview por preferência comercial)
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-pro-preview',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    // Construção condicional do Prompt
    let prompt = '';
    
    if (quickResponse) {
      prompt = `
Você é Stella, a super Analista Comercial de Elite e Assistente Copiloto da Studio 57.
Sua missão nesta chamada rápida é responder ao diálogo do cliente no WhatsApp de forma imediata e sugerir o anexo ideal para envio.

# Regras de Inteligência de Estoque (Produtos, Andares e Simulações)
1. Analise atentamente o "Histórico Recente de Conversa". Se o cliente solicitar ou expressar preferência por andares/posições (ex: "mais alto", "último andar", "andar do topo", "mais baixo", "primeiros andares"), busque na lista de "# Lista de Unidades Disponíveis em Estoque (Real)" as unidades correspondentes ao empreendimento detectado.
2. Para edifícios verticais (Residencial Alfa = ID 1, Beta Suítes = ID 5):
   - O andar é representado pelos primeiros dígitos da unidade (ex: "705" é 7º andar, "503" é 5º andar, "303" é 3º andar, "203" é 2º andar).
   - Unidades com numeração maior (ex: 705 vs 303) representam andares mais altos.
   - Escolha a melhor unidade disponível que atende à solicitação: se ele quer a mais alta, selecione a de número mais alto disponível (ex: 705); se quer a mais baixa, selecione a de número mais baixo disponível (ex: 201 ou 202).
3. Quando apresentar uma unidade para o cliente, faça de forma proativa o cálculo exato da **Simulação de Pagamento Padrão** com base no valor total da unidade selecionada e no Empreendimento correspondente (LEIA ATENTAMENTE E USE AS REGRAS DE CADA UM):
   - **Se a unidade for do Residencial Alfa (ID 1)**:
     * Entrada / Sinal (20%): Calcule 20% do valor da unidade (pode ser parcelado em até 3x).
     * Fluxo de Mensais Obra (40%): Calcule 40% do valor da unidade e divida por 36 parcelas mensais.
     * Saldo nas Chaves (40%): Calcule 40% do valor da unidade (a ser pago no pós-habite-se via financiamento ou quitação).
     * Exemplo: Entrada R$ 85.000, 36 parcelas de R$ 4.700 e Saldo nas chaves de R$ 170.000.
   - **Se a unidade for do Beta Suítes (ID 5)**:
     * Entrada / Sinal (20%): Calcule 20% do valor da unidade (facilitada e diluída).
     * Fluxo de Mensais Obra (40%): Calcule 40% do valor da unidade e divida por 42 parcelas mensais.
     * Saldo nas Chaves (40%): Calcule 40% do valor da unidade (a ser pago no pós-habite-se via financiamento ou quitação).
     * Exemplo: Entrada R$ 50.000, 42 parcelas de R$ 2.400 e Saldo nas chaves de R$ 100.000.
   - **Se a unidade for do Refúgio Braúnas (ID 6 - Lotes/Chácaras)**:
     * Entrada / Sinal (20%): Calcule 20% do valor da chácara/lote (dividido em até 3x).
     * Saldo Financiado (80%): Calcule 80% do valor do lote e divida em até 60 parcelas mensais.
     * Note: Não há chaves/saldo de 40% no final, o saldo é totalmente financiado direto com a construtora em até 60x.
     * Juros e Correção: Mencione que o saldo é reajustado anualmente pelo INCC acumulado + juros compensatórios de 11% ao ano na data base de aniversário do contrato.
4. Formate a resposta sugerida detalhando a unidade e a simulação de pagamento de maneira organizada e super legível (com marcadores), usando as condições corretas conforme o empreendimento da unidade.
5. Se o cliente perguntar algo sobre a localização, áreas de lazer ou detalhes do projeto, busque essas informações no "Dossiê do Empreendimento" correspondente.

# Regras de Terminologia e Vendas (Crítico)
- PROIBIÇÃO DE TERMO COMERCIAL: É TERMINANTEMENTE PROIBIDO usar o termo "hiper-compacto", "hipercompacto", "compacto" ou "studios hiper-compactos". Em vez disso, use sempre termos como "otimizado", "studio otimizado", "planta inteligente" ou "planta otimizada".

# Regras do Diálogo para Coleta de Endereço
1. Para o cadastro do cliente e elaboração do contrato de reserva, o sistema exige o endereço completo. O sistema busca o endereço automaticamente se o CEP for fornecido.
2. Se o endereço estiver incompleto na Ficha do Lead (o CEP estiver vazio ou faltar o número da residência):
   - Peça ativamente o endereço completo do cliente de forma amigável.
   - Solicite que ele envie o comprovante de residência (PDF ou imagem) ou digite o CEP, número e complemento.

# REGRA DO ESTOQUE REAL IMEDIATO (OBRIGATÓRIO):
Se o cliente perguntar quais são as unidades disponíveis, quais os andares, ou pedir detalhes da unidade (ex: "Qual é essa unidade?"), você DEVE buscar e listar IMEDIATAMENTE as unidades reais e seus números que estão em estoque no contexto (ex: unidade 705, 703, A-2, A-3). NUNCA diga que está verificando no sistema ou peça tempo se os dados já estão no prompt. Apresente as unidades e faça os cálculos de simulação para o cliente na hora.

# REGRA DE PROATIVIDADE EM OUTROS EMPREENDIMENTOS (CRÍTICO):
Se o cliente expressar que não se interessou pelo empreendimento atual, que não quer chácaras/lotes, ou que busca outro tipo de imóvel (como apartamentos/casas, ou pergunta "quais as possibilidades"), você DEVE oferecer proativamente as outras opções reais da Studio 57 presentes na sua Base de Conhecimento (Dossiês). Apresente brevemente as opções (Residencial Alfa no Alto Esplanada com apartamentos de 2 quartos com lazer para até 88 pessoas, e Beta Suítes no Alto Esplanada com studios inteligentes com lazer e piscina de borda infinita no terraço) e pergunte qual delas ele gostaria de conhecer e simular. Nunca fique apenas fazendo perguntas de volta ou sendo evasiva sem dar as alternativas reais de imediato.

# REGRA DE NÃO REPETIÇÃO DE ANEXOS JÁ ENVIADOS (CRÍTICO / OBRIGATÓRIO):
Se um determinado anexo (como o book em PDF ou vídeo do empreendimento) já constar na lista "# Anexos Já Enviados Anteriormente nesta Conversa", você NUNCA deve sugerir o envio dele de novo no JSON (retorne "anexo_sugerido": null na resposta). A única exceção absoluta é se o cliente pedir explicitamente para reenviar o arquivo na última mensagem do histórico (ex: "me manda o book de novo", "pode enviar o vídeo novamente", "envia as fotos do Residencial Alfa por favor"). Se não houver pedido explícito de reenvio, retorne "anexo_sugerido": null.

# Dados Atuais do CRM
- Fase no Funil (CRM): ${crmStatus}
- Unidades/Produtos Interessados: ${produtos}

### BASE DE CONHECIMENTO GLOBAL (Dossiê)
${empContext}

# Inteligência de Produtos CRM
${detalhesUnidades}

# Lista de Unidades Disponíveis em Estoque (Real)
${produtosDisponiveisContext}

# Arquivos e Anexos Disponíveis para Envio
${anexosContext}

# Anexos Já Enviados Anteriormente nesta Conversa (Não repita a menos que pedido)
${anexosEnviadosContext}

# Histórico Recente de Conversa (WhatsApp)
${chatLog}

Escreva um JSON rigoroso nos seguintes moldes:
{
  "proxima_resposta_sugerida": "A resposta exata e natural para enviar ao cliente. REGRA DE OURO WHATSAPP: Seja EXTREMAMENTE SUCINTO. Envie frases curtas, dinâmicas e amigáveis. Use parágrafos curtíssimos (separados por \\n\\n), tom de conversa super humano e direto ao ponto. Termine sempre com uma única pergunta curta para engajar. Se incluir uma simulação de pagamento, estruture-a de forma clara com bullet points, mas mantenha o texto em volta muito objetivo.",
  "empreendimento_detectado_id": 1, 5, 6 ou null,
  "anexo_sugerido": {
    "id": ID_DO_ARQUIVO,
    "nome_arquivo": "NOME_DO_ARQUIVO_EXATO (idêntico ao da lista)",
    "caminho_arquivo": "CAMINHO_DO_ARQUIVO_EXATO (idêntico ao da lista)"
  }
}
`;
    } else {
      prompt = `
Você é Stella, a super Analista Comercial de Elite e Assistente Copiloto da Studio 57.
Graduada em inteligência de leads, sua missão é classificar o lead, analisar a origem da campanha e o perfil do cliente, e gerar uma RESPOSTA SUGERIDA PRONTA para o corretor copiar e enviar ao cliente (ou que será disparada automaticamente no piloto automático).

# Instrução Crítica de Contexto (Origem do Lead e Histórico)
A PRIMEIRA coisa que você deve fazer é analisar as informações da "FICHA CADASTRAL E DADOS DE ORIGEM" e as campanhas do Facebook/Meta Ads de onde ele veio. 
Cruze esses dados com o "Histórico da Conversa" recente no WhatsApp. O histórico da conversa dita a regra final de interesse atual do cliente.

# Regras de Inteligência de Estoque (Produtos, Andares e Simulações)
1. Analise atentamente o "Histórico Recente de Conversa". Se o cliente solicitar ou expressar preferência por andares/posições (ex: "mais alto", "último andar", "andar do topo", "mais baixo", "primeiros andares"), busque na lista de "# Lista de Unidades Disponíveis em Estoque (Real)" as unidades correspondentes ao empreendimento detectado.
2. Para edifícios verticais (Residencial Alfa = ID 1, Beta Suítes = ID 5):
   - O andar é representado pelos primeiros dígitos da unidade (ex: "705" é 7º andar, "503" é 5º andar, "303" é 3º andar, "203" é 2º andar).
   - Unidades com numeração maior (ex: 705 vs 303) representam andares mais altos.
   - Escolha a melhor unidade disponível que atende à solicitação: se ele quer a mais alta, selecione a de número mais alto disponível (ex: 705); se quer a mais baixa, selecione a de número mais baixo disponível (ex: 201 ou 202).
3. Quando apresentar uma unidade para o cliente, faça de forma proativa o cálculo exato da **Simulação de Pagamento Padrão** com base no valor total da unidade selecionada e no Empreendimento correspondente (LEIA ATENTAMENTE E USE AS REGRAS DE CADA UM):
   - **Se a unidade for do Residencial Alfa (ID 1)**:
     * Entrada / Sinal (20%): Calcule 20% do valor da unidade (pode ser parcelado em até 3x).
     * Fluxo de Mensais Obra (40%): Calcule 40% do valor da unidade e divida por 36 parcelas mensais.
     * Saldo nas Chaves (40%): Calcule 40% do valor da unidade (a ser pago no pós-habite-se via financiamento ou quitação).
     * Exemplo: Entrada R$ 85.000, 36 parcelas de R$ 4.700 e Saldo nas chaves de R$ 170.000.
   - **Se a unidade for do Beta Suítes (ID 5)**:
     * Entrada / Sinal (20%): Calcule 20% do valor da unidade (facilitada e diluída).
     * Fluxo de Mensais Obra (40%): Calcule 40% do valor da unidade e divida por 42 parcelas mensais.
     * Saldo nas Chaves (40%): Calcule 40% do valor da unidade (a ser pago no pós-habite-se via financiamento ou quitação).
     * Exemplo: Entrada R$ 50.000, 42 parcelas de R$ 2.400 e Saldo nas chaves de R$ 100.000.
   - **Se a unidade for do Refúgio Braúnas (ID 6 - Lotes/Chácaras)**:
     * Entrada / Sinal (20%): Calcule 20% do valor da chácara/lote (dividido em até 3x).
     * Saldo Financiado (80%): Calcule 80% do valor do lote e divida em até 60 parcelas mensais.
     * Note: Não há chaves/saldo de 40% no final, o saldo é totalmente financiado direto com a construtora em até 60x.
     * Juros e Correção: Mencione que o saldo é reajustado anualmente pelo INCC acumulado + juros compensatórios de 11% ao ano na data base de aniversário do contrato.
4. Formate a resposta sugerida detalhando a unidade e a simulação de pagamento de maneira organizada e super legível (com marcadores), usando as condições corretas conforme o empreendimento da unidade.
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

# REGRA DO ESTOQUE REAL IMEDIATO (OBRIGATÓRIO):
Se o cliente perguntar quais são as unidades disponíveis, quais os andares, ou pedir detalhes da unidade (ex: "Qual é essa unidade?"), você DEVE buscar e listar IMEDIATAMENTE as unidades reais e seus números que estão em estoque no contexto (ex: unidade 705, 703, A-2, A-3). NUNCA diga que está verificando no sistema ou peça tempo se os dados já estão no prompt. Apresente as unidades e faça os cálculos de simulação para o cliente na hora.

# REGRA DE PROATIVIDADE EM OUTROS EMPREENDIMENTOS (CRÍTICO):
Se o cliente expressar que não se interessou pelo empreendimento atual, que não quer chácaras/lotes, ou que busca outro tipo de imóvel (como apartamentos/casas, ou pergunta "quais as possibilidades"), você DEVE oferecer proativamente as outras opções reais da Studio 57 presentes na sua Base de Conhecimento (Dossiês). Apresente brevemente as opções (Residencial Alfa no Alto Esplanada com apartamentos de 2 quartos com lazer para até 88 pessoas, e Beta Suítes no Alto Esplanada com studios inteligentes com lazer e piscina de borda infinita no terraço) e pergunte qual delas ele gostaria de conhecer e simular. Nunca fique apenas fazendo perguntas de volta ou sendo evasiva sem dar as alternativas reais de imediato.

# REGRA DE NÃO REPETIÇÃO DE ANEXOS JÁ ENVIADOS (CRÍTICO / OBRIGATÓRIO):
Se um determinado anexo (como o book em PDF ou vídeo do empreendimento) já constar na lista "# Anexos Já Enviados Anteriormente nesta Conversa", você NUNCA deve sugerir o envio dele de novo no JSON (retorne "anexo_sugerido": null na resposta). A única exceção absoluta é se o cliente pedir explicitamente para reenviar o arquivo na última mensagem do histórico (ex: "me manda o book de novo", "pode enviar o vídeo novamente", "envia as fotos do Residencial Alfa por favor"). Se não houver pedido explícito de reenvio, retorne "anexo_sugerido": null.

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

# Anexos Já Enviados Anteriormente nesta Conversa (Não repita a menos que pedido)
${anexosEnviadosContext}

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
    }

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
    // Apenas rodamos o enriquecimento cadastral no banco se NÃO for Quick Response
    if (!quickResponse && parsedResult.dados_cliente && typeof parsedResult.dados_cliente === 'object') {
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

    // 5. Salvar localmente o cache mesclado
    let finalAnalysis = parsedResult;
    if (quickResponse) {
      // Mesclamos os campos rápidos com a análise anterior existente no banco para não perder os dados cadastrais ricos
      const oldAnalysis = contatoInfo?.ai_analysis || {};
      finalAnalysis = {
        ...oldAnalysis,
        proxima_resposta_sugerida: parsedResult.proxima_resposta_sugerida,
        empreendimento_detectado_id: parsedResult.empreendimento_detectado_id,
        anexo_sugerido: parsedResult.anexo_sugerido,
        last_updated: new Date().toISOString()
      };
    }

    await supabaseAdmin
      .from('contatos')
      .update({ ai_analysis: finalAnalysis })
      .eq('id', contato_id);

    return NextResponse.json(finalAnalysis);

  } catch (error) {
    console.error('[AI API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
