const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function run() {
  console.log("=== SIMULANDO APRENDIZADO ATIVO DA STELLA (BACKEND) ===");

  const contato_id = 5598; // Ranniere
  const organizacao_id = 2; // Studio 57
  const human_input = "O condomínio do Residencial Alfa custa R$ 350,00 e inclui gás encanado.";

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Buscar dados do contato (equivalente à API)
    const { data: contatoInfo, error: contatoError } = await supabaseAdmin
      .from('contatos')
      .select('nome, ai_analysis')
      .eq('id', contato_id)
      .eq('organizacao_id', organizacao_id)
      .single();

    if (contatoError) throw contatoError;
    console.log("[OK] Dados do contato carregados.");

    // 2. Buscar dados do funil comercial
    const { data: funil, error: funilError } = await supabaseAdmin
      .from('contatos_no_funil')
      .select('id, coluna_id')
      .eq('contato_id', contato_id)
      .maybeSingle();

    if (funilError) throw funilError;
    console.log("[OK] Dados do funil carregados.");

    // 3. Buscar mensagens recentes
    const { data: messages, error: msgsError } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('content, direction, sent_at')
      .eq('contato_id', contato_id)
      .eq('organizacao_id', organizacao_id)
      .order('sent_at', { ascending: false })
      .limit(25);

    if (msgsError) throw msgsError;
    console.log("[OK] Histórico de mensagens carregado.");

    // Executar lógica de Active Learning
    console.log(`[Active Learning] Processando: "${human_input}"`);

    // 1. Identificar o empreendimento
    let empIdParaAtualizar = contatoInfo?.ai_analysis?.empreendimento_detectado_id 
      || funil?.empreendimento_id;

    if (!empIdParaAtualizar) {
      const { data: firstEmp } = await supabaseAdmin
        .from('empreendimentos')
        .select('id')
        .eq('organizacao_id', organizacao_id)
        .limit(1)
        .maybeSingle();
      if (firstEmp) empIdParaAtualizar = firstEmp.id;
    }

    console.log(`[Active Learning] Empreendimento ID original detectado: ${empIdParaAtualizar}`);
    empIdParaAtualizar = 1; // Forçamos o Residencial Alfa (ID 1) para carregar o dossiê completo de teste
    console.log(`[Active Learning] Empreendimento ID forçado para teste: ${empIdParaAtualizar}`);

    // 2. Buscar o dossiê atual
    let dossieAtual = "";
    let empreendimentoNome = "Empreendimento";
    if (empIdParaAtualizar) {
      const { data: empData, error: empError } = await supabaseAdmin
        .from('empreendimentos')
        .select('nome, dossie_ia')
        .eq('id', empIdParaAtualizar)
        .single();
      if (empError) {
        console.error("Erro ao buscar empreendimento:", empError.message);
      }
      if (empData) {
        dossieAtual = empData.dossie_ia || "";
        empreendimentoNome = empData.nome;
      }
    }

    // 3. Gerar a reescrita da resposta comercial (Usando o modelo Flash rápido)
    console.log("[Active Learning] Chamando Gemini Flash para reescrever resposta...");
    const modelPro = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const reversedMessages = [...(messages || [])].reverse();
    const chatLogForRewriting = reversedMessages.filter(m => m.content).map(m => {
      const actor = m.direction === 'inbound' ? 'Cliente' : 'Corretor';
      return `[${new Date(m.sent_at).toLocaleString('pt-BR')}] ${actor}: ${m.content}`;
    }).join('\n');

    const reescreverPrompt = `
Você é a Stella, a assistente inteligente e de elite da Studio 57.
A última resposta comercial sugerida por você continha alguma informação incompleta ou você não soube responder.
O corretor humano interveio e forneceu a informação correta sobre o empreendimento ${empreendimentoNome}:
"${human_input}"

Com base nesta informação e no histórico recente de mensagens do WhatsApp:
---
${chatLogForRewriting}
---

Escreva a resposta de WhatsApp perfeita e polida para o cliente. 
Gere apenas JSON no formato:
{
  "proxima_resposta_sugerida": "A resposta exata gerada para enviar no WhatsApp."
}
`;

    let respostaSugeridaReescrita = "";
    try {
      const rewriteResult = await modelPro.generateContent([{ text: reescreverPrompt }]);
      const rewriteText = rewriteResult.response.text();
      const cleanRewrite = rewriteText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsedRewrite = JSON.parse(cleanRewrite);
      respostaSugeridaReescrita = parsedRewrite.proxima_resposta_sugerida || "";
      console.log("[Active Learning] Resposta reescrita gerada com sucesso!");
    } catch (rewriteErr) {
      console.error('[Active Learning] Erro ao reescrever resposta:', rewriteErr.message);
      respostaSugeridaReescrita = `Perfeito! Confirmei aqui e ${human_input}`;
    }

    // 4. Enriquecer o Dossiê no banco
    if (empIdParaAtualizar && dossieAtual) {
      console.log("[Active Learning] Enriquecendo o dossiê do empreendimento...");
      const aprenderPrompt = `
Você é o motor de inteligência de dados da Studio 57.
Sua missão é enriquecer o Dossiê Técnico do Empreendimento adicionando uma nova informação fornecida pela equipe comercial de forma totalmente estruturada e organizada no documento Markdown existente.

Dossiê atual:
${dossieAtual}

Nova informação:
"${human_input}"

Retorne apenas o Markdown consolidado final.
`;

      try {
        const learnResult = await modelPro.generateContent([{ text: aprenderPrompt }]);
        const novoDossie = learnResult.response.text().trim();
        
        console.log(`[Active Learning] Novo Dossiê gerado com sucesso! (Tamanho: ${novoDossie.length} caracteres).`);
        console.log("[Active Learning] Pulando UPDATE físico no banco de dados por segurança de teste.");
      } catch (learnErr) {
        console.error('[Active Learning] Erro no fluxo de aprendizado do dossiê:', learnErr.message);
      }
    }

    // 5. Mesclar e atualizar o cache do contato
    console.log("[Active Learning] Atualizando o ai_analysis do contato...");
    const oldAnalysis = contatoInfo?.ai_analysis || {};
    const mergedAnalysis = {
      ...oldAnalysis,
      proxima_resposta_sugerida: respostaSugeridaReescrita,
      resumo_interacao: `${oldAnalysis.resumo_interacao || ''}\n[Intervenção Humana] Fato aprendido: ${human_input}`,
      last_updated: new Date().toISOString(),
      mover_para_coluna_id: null
    };

    const { error: updateContactErr } = await supabaseAdmin
      .from('contatos')
      .update({ ai_analysis: mergedAnalysis })
      .eq('id', contato_id);

    if (updateContactErr) {
      console.error("[Active Learning Error] Erro ao atualizar contatos:", updateContactErr.message);
      throw updateContactErr;
    }
    console.log("[OK] Registro de contato atualizado no banco.");

    // 6. Mover de volta para Em Atendimento
    if (funil && funil.coluna_id === '7de9b5b4-05fa-4813-82d8-7790406ee268') {
      console.log("[Active Learning] Movendo lead de volta para Em Atendimento...");
      const { error: moveBackError } = await supabaseAdmin
        .from('contatos_no_funil')
        .update({ 
          coluna_id: '029c8d6a-4799-4f4b-a55e-b4d5426718c0', 
          updated_at: new Date().toISOString() // usamos toISOString para consistência
        })
        .eq('id', funil.id);
        
      if (moveBackError) {
        console.error('[Active Learning] Erro ao mover de volta para Em Atendimento:', moveBackError.message);
        throw moveBackError;
      }
      console.log('[OK] Lead movido de volta para Em Atendimento com sucesso.');
    }

    console.log("\n=== APRENDIZADO ATIVO SIMULADO COM SUCESSO! ===");

  } catch (error) {
    console.error("\n❌ ERRO DETECTADO NO APRENDIZADO ATIVO:", error);
  }
}

run().catch(console.error);
