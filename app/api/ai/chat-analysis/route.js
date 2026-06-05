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
    const empreendimentoIds = Array.from(empIdsSet);

    // Obter BASE DE CONHECIMENTO GLOBAL (Todos os Dossiês)
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

    let anexosContext = "Nenhum anexo público encontrado.";
    if (empreendimentoIds.length > 0) {
      const { data: anexos } = await supabaseAdmin
        .from('empreendimento_anexos')
        .select('nome_arquivo, descricao')
        .in('empreendimento_id', empreendimentoIds)
        .eq('pode_enviar_anexo', true);
      
      if (anexos && anexos.length > 0) {
         anexosContext = anexos.map(a => `- Arquivo: [${a.nome_arquivo}] (${a.descricao || 'Sem descrição'})`).join('\n');
      }
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
Sua missão é classificar o lead, analisar a origem da campanha e o perfil do cliente, e gerar uma RESPOSTA SUGERIDA PRONTA para o corretor copiar e enviar ao cliente.

# Instrução Crítica de Contexto (Origem do Lead e Histórico)
A PRIMEIRA coisa que você deve fazer é analisar as informações da "FICHA CADASTRAL E DADOS DE ORIGEM" e as campanhas do Facebook/Meta Ads de onde ele veio. 
Geralmente, o nome da campanha (meta_campaign_name), do conjunto de anúncios (meta_adset_name) ou do próprio anúncio (meta_ad_name) contêm o nome do empreendimento ou o tipo de público-alvo (investidores, compradores de primeiro imóvel). 
Analise também as respostas do formulário da Meta (meta_form_data), que contêm perguntas sobre intenção de compra, renda e objetivos.
Cruze esses dados com o "Histórico da Conversa" recente no WhatsApp. O histórico da conversa dita a regra final de interesse atual caso ele tenha mudado de ideia.

# Ficha Cadastral e Origem do Lead
${fichaLead}

# Dados Atuais do CRM
- Fase no Funil (CRM): ${crmStatus}
- Unidades/Produtos Interessados: ${produtos}

### BASE DE CONHECIMENTO GLOBAL (Cérebro da Studio 57)
${empContext}

# Inteligência de Produtos (Caso o cliente pergunte de valores ou área)
${detalhesUnidades}

# Arquivos e Anexos Disponíveis (Se o cliente pedir material/fotos/plantas, sugira o envio de um destes)
${anexosContext}

# Histórico Recente de Conversa (WhatsApp)
${chatLog}

# Regras de Extração e Análise do Cliente (Chave "dados_cliente")
Analise todos os dados disponíveis (Ficha do Lead, Origem do Meta Ads, Formulário Meta, Dossiês e Conversa no WhatsApp) para determinar o perfil do cliente:
1. "objetivo": Classifique rigorosamente como "MORADIA", "INVESTIMENTO" ou "LAZER". 
   - Analise os nomes de Campanha (meta_campaign_name), Adset (meta_adset_name) ou Anúncio (meta_ad_name):
     - Campanhas contendo "Alfa" (ex: "CAMPANHA CADASTRO ALFA") referem-se ao Residencial Alfa (apartamentos voltados para moradia). Objetivo inicial padrão: "MORADIA".
     - Campanhas contendo "Beta" ou "Samara" (ex: "BETA SUÍTES") referem-se ao Beta Suítes (apartamentos de alto padrão voltados para investimento/rentabilidade em temporada/Airbnb). Objetivo inicial padrão: "INVESTIMENTO".
     - Campanhas contendo "Braúnas" ou "Lazer" (ex: "Lotes de Lazer", "Chácaras Braúnas") referem-se às chácaras/lotes de lazer de Braúnas. Objetivo inicial padrão: "LAZER" ou "MORADIA".
   - Analise as respostas do formulário da Meta (meta_form_data): perguntas como "objetivo?" contendo "moradia" ou "investimento_" indicam a intenção inicial. Padronize essas respostas ("investimento_" -> "INVESTIMENTO").
   - O histórico de conversa no WhatsApp (chat log) é a verdade final absoluta e prevalece sobre as campanhas. Se o lead veio de uma campanha do Beta Suítes (Investimento) mas no chat ele diz que pretende morar com a família no apartamento, classifique como "MORADIA".
   - Caso seja inconclusivo e não haja nenhuma informação, retorne null.
2. "nome": Nome completo do cliente caso tenha sido explicitamente citado ou corrigido. Se no CRM estiver apenas o primeiro nome e no histórico ele informar o completo, retorne o completo.
3. "cpf" e "cnpj": Apenas dígitos se informados.
4. "renda_familiar": Renda bruta familiar (se informada no formulário da Meta ou no chat).
5. "fgts": boolean.
6. "mais_de_3_anos_clt": boolean.
7. "cargo": Profissão ou cargo.
8. "estado_civil": "Solteiro", "Casado", "Divorciado", "Separado" ou "União Estável".
9. "birth_date": Data de nascimento YYYY-MM-DD.
10. Endereço: "cep", "address_street", "address_number", "address_complement", "neighborhood", "city", "state".

Com base SOMENTE neste histórico recente e contexto do projeto, escreva um JSON rigoroso nos seguintes moldes:
{
  "resumo_interacao": "Texto conciso de até 3 linhas resumindo a intenção real, de onde o lead veio (campanha) e o ponto de temperatura da conversa.",
  "temperatura": "Quente" ou "Morno" ou "Frio",
  "fase_crm_atual": "${crmStatus}",
  "proxima_acao_sugerida": "Dica direta e acionável para o corretor.",
  "proxima_resposta_sugerida": "A resposta exata e natural para enviar ao cliente. REGRA DE OURO WHATSAPP: Seja EXTREMAMENTE SUCINTO. Ninguém lê textões. Fracione as ideias, use parágrafos curtíssimos (separados por \\n\\n), tom humano e direto ao ponto. Termine sempre com uma pergunta curta para engajar.",
  "dados_cliente": {
    "nome": "Nome completo ou null",
    "cpf": "Apenas dígitos do CPF ou null",
    "cnpj": "Apenas dígitos do CNPJ ou null",
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

    const result = await model.generateContent(prompt);
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

        // Função auxiliar para atualizar apenas campos vazios/nulos no banco de dados
        const preencherSeVazio = (field, value) => {
          const currentValue = currentContact[field];
          if (value !== undefined && value !== null && (currentValue === null || currentValue === undefined || String(currentValue).trim() === '')) {
            updateData[field] = value;
          }
        };

        preencherSeVazio('cpf', dc.cpf);
        preencherSeVazio('cnpj', dc.cnpj);
        preencherSeVazio('fgts', dc.fgts);
        preencherSeVazio('renda_familiar', dc.renda_familiar);
        preencherSeVazio('cargo', dc.cargo);
        preencherSeVazio('estado_civil', dc.estado_civil);
        preencherSeVazio('mais_de_3_anos_clt', dc.mais_de_3_anos_clt);
        preencherSeVazio('cep', dc.cep);
        preencherSeVazio('address_street', dc.address_street);
        preencherSeVazio('address_number', dc.address_number);
        preencherSeVazio('address_complement', dc.address_complement);
        preencherSeVazio('neighborhood', dc.neighborhood);
        preencherSeVazio('city', dc.city);
        preencherSeVazio('state', dc.state);
        preencherSeVazio('birth_date', dc.birth_date);

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
