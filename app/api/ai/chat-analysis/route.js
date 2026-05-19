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

    // NOVO: Extrair IDs de Empreendimentos para buscar anexos e contexto
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

    // 3. Obter BASE DE CONHECIMENTO GLOBAL (Todos os Dossiês)
    // Em vez de restringir ao CRM, a IA recebe a inteligência de todos os empreendimentos para decidir com base no chat.
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

    // 4. Invocar a IA 
    // OBS: Usamos o identificador mais moderno: gemini-3.1-pro-preview
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-pro-preview',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
Você é Stella, a super Analista Comercial de Elite e Assistente Copiloto da Studio 57.
Sua missão é classificar o lead e gerar uma RESPOSTA SUGERIDA PRONTA para o corretor copiar e enviar ao cliente.

# Instrução Crítica de Contexto (O Histórico é Rei)
A PRIMEIRA coisa que você deve fazer é ler atentamente o "Histórico da Conversa". O cliente pode ter chegado por um anúncio de um empreendimento (origem no CRM), mas ao longo da conversa, demonstrar interesse em OUTRO empreendimento. A CONVERSA SEMPRE DITA A REGRA. Identifique qual empreendimento o cliente quer AGORA. Cruze essa informação com a "BASE DE CONHECIMENTO GLOBAL" abaixo e use as regras do empreendimento correto.

# Dados Atuais Comerciais
- Fase no Funil (CRM): ${crmStatus}
- Produtos Interessados: ${produtos}
${empContext}

# Inteligência de Produtos (Caso o cliente pergunte de valores ou área)
${detalhesUnidades}

# Arquivos e Anexos Disponíveis (Se o cliente pedir material/fotos/plantas, sugira o envio de um destes)
${anexosContext}

# Histórico Recente de Conversa (WhatsApp)
${chatLog}

Com base SOMENTE neste histórico recente e contexto do projeto, escreva um JSON rigoroso nos seguintes moldes:
{
  "resumo_interacao": "Texto conciso de até 3 linhas dizendo exatamente o ponto de temperatura da conversa.",
  "temperatura": "Quente" ou "Morno" ou "Frio",
  "fase_crm_atual": "${crmStatus}",
  "proxima_acao_sugerida": "Dica direta e acionável para o corretor. Ex: Se o cliente pediu material, diga 'Envie o PDF do Book de Vendas que ele solicitou'.",
  "proxima_resposta_sugerida": "A resposta exata e natural para enviar ao cliente. REGRA DE OURO WHATSAPP: Seja EXTREMAMENTE SUCINTO. Ninguém lê textões. Fracione as ideias, use parágrafos curtíssimos (separados por \\n\\n), tom humano e direto ao ponto. Termine sempre com uma pergunta curta para engajar."
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
