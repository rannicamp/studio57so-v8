// scratch/enviar_template_hudson.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const { processarAnaliseStella } = require('../app/api/ai/stella/processor');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const HUDSON_PHONE = '5533988157890';
const CONTATO_ID = 6124;
const ORGANIZACAO_ID = 2;

async function obterTemplatesMeta(whatsappConfig) {
  const businessAccountId = whatsappConfig.whatsapp_business_account_id;
  const token = whatsappConfig.token_meta || process.env.WHATSAPP_SYSTEM_USER_TOKEN;

  if (!businessAccountId) {
    console.warn("[Templates] whatsapp_business_account_id ausente nas configurações.");
    return [];
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${businessAccountId}/message_templates?limit=100`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const resJson = await res.json();
      const templates = (resJson.data || []).filter(t => t.status === 'APPROVED');
      console.log(`[Templates] Encontrados ${templates.length} templates aprovados na Meta.`);
      return templates;
    } else {
      console.warn(`[Templates] Falha ao consultar templates da Meta. Status: ${res.status}`);
      return [];
    }
  } catch (err) {
    console.error('[Templates] Erro ao buscar templates Meta:', err.message);
    return [];
  }
}

async function main() {
  console.log("=== EXECUTANDO REATIVAÇÃO DE CONTATO DA STELLA (JANELA FECHADA) ===");

  // 1. Obter configurações de WhatsApp da Org 2
  const { data: configMeta, error: errConf } = await supabase
    .from('integracoes_meta')
    .select('*')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .eq('tipo_provedor', 'whatsapp')
    .limit(1)
    .maybeSingle();

  if (errConf || !configMeta) {
    console.error("Erro ao buscar configurações do WhatsApp da Org:", errConf?.message || "Não encontrado");
    return;
  }

  // 2. Buscar templates reais aprovados
  const templatesMeta = await obterTemplatesMeta(configMeta);
  console.log("Templates disponíveis na Meta:");
  templatesMeta.forEach(t => console.log(`- ${t.name} (categoria: ${t.category}, idioma: ${t.language})`));

  if (templatesMeta.length === 0) {
    console.error("Nenhum template aprovado encontrado na Meta. Abortando.");
    return;
  }

  // 3. Buscar dados atuais do contato no banco
  const { data: contatoInfo } = await supabase
    .from('contatos')
    .select('*')
    .eq('id', CONTATO_ID)
    .single();

  // 4. Executar processamento da Stella IA com janelaFechada = true
  console.log("\nAcionando o cérebro da Stella IA com Janela Fechada = true...");
  const aiResult = await processarAnaliseStella(supabase, {
    contato_id: CONTATO_ID,
    organizacao_id: ORGANIZACAO_ID,
    contatoInfo: contatoInfo,
    quickResponse: true,
    janelaFechada: true,
    templatesDisponiveis: templatesMeta,
    pular_atualizacao_crm: true
  });

  console.log("\nRetorno da Stella IA:");
  console.log(JSON.stringify(aiResult, null, 2));

  // 5. Se sugerir template, enviar de verdade!
  if (aiResult && aiResult.template_selecionado && aiResult.template_selecionado !== 'null') {
    const templateNome = aiResult.template_selecionado;
    const componentes = aiResult.template_componentes || [];
    
    console.log(`\nStella sugeriu o template: "${templateNome}"`);
    console.log("Componentes sugeridos:", JSON.stringify(componentes, null, 2));

    const phoneId = configMeta.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || '690198827516149';
    const token = configMeta.token_meta || process.env.WHATSAPP_SYSTEM_USER_TOKEN;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: HUDSON_PHONE,
      type: 'template',
      template: {
        name: templateNome,
        language: { code: 'pt_BR' }
      }
    };

    if (componentes.length > 0) {
      payload.template.components = componentes;
    }

    console.log("Enviando requisição de template para a Meta API...");
    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const metaData = await metaRes.json();
    console.log(`Status de retorno da Meta: ${metaRes.status} (${metaRes.statusText})`);
    console.log("Resposta da Meta:", JSON.stringify(metaData, null, 2));

    if (metaRes.ok && metaData.messages && metaData.messages[0]) {
      const messageId = metaData.messages[0].id;
      console.log(`Template enviado com sucesso! Meta ID: ${messageId}`);

      // Registrar no banco
      const resolvedText = `(Automação) Template: ${templateNome}`;
      const { error: dbError } = await supabase
        .from('whatsapp_messages')
        .insert({
          contato_id: CONTATO_ID,
          sender_id: phoneId,
          receiver_id: HUDSON_PHONE,
          content: resolvedText,
          direction: 'outbound',
          status: 'sent',
          message_id: messageId,
          organizacao_id: ORGANIZACAO_ID
        });

      if (dbError) console.error("Erro ao gravar mensagem no banco:", dbError.message);
      else console.log("Template gravado no histórico whatsapp_messages!");

    } else {
      console.error("Erro no envio do template via Meta:", metaData.error?.message || 'Erro desconhecido');
    }
  } else {
    console.log("\nA Stella não sugeriu nenhum template para reativação.");
  }
}

main().catch(console.error);
