// scratch/listar_e_enviar_template.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

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

async function main() {
  console.log("=== ENVIANDO TEMPLATE DE REATIVAÇÃO PARA O HUDSON ===");

  // 1. Obter integração do WhatsApp da Org 2
  const { data: configMeta, error: errConf } = await supabase
    .from('configuracoes_whatsapp')
    .select('*')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .limit(1)
    .maybeSingle();

  if (errConf || !configMeta) {
    console.error("Erro ao buscar configurações do WhatsApp da Org:", errConf?.message || "Não encontrado");
    return;
  }

  const businessAccountId = configMeta.whatsapp_business_account_id;
  const token = configMeta.token_meta || configMeta.token || process.env.WHATSAPP_SYSTEM_USER_TOKEN;
  const phoneId = configMeta.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || '690198827516149';

  console.log("Configurações Carregadas de configuracoes_whatsapp:");
  console.log(`- Phone Number ID: ${phoneId}`);
  console.log(`- Business Account ID: ${businessAccountId}`);

  // 2. Consultar os templates aprovados na Meta
  console.log("\nConsultando templates aprovados na Meta...");
  const urlTemplates = `https://graph.facebook.com/v21.0/${businessAccountId}/message_templates?limit=100`;
  const res = await fetch(urlTemplates, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    console.error(`Erro ao consultar templates. Status: ${res.status}`);
    const errText = await res.text();
    console.error("Resposta da Meta:", errText);
    return;
  }

  const resJson = await res.json();
  const templates = (resJson.data || []).filter(t => t.status === 'APPROVED');
  console.log(`Templates Aprovados Encontrados: ${templates.length}`);
  
  templates.forEach(t => {
    console.log(`- Nome: "${t.name}" (idioma: ${t.language}, categoria: ${t.category})`);
    const bodyComp = (t.components || []).find(c => c.type === 'BODY');
    if (bodyComp) console.log(`  Texto: "${bodyComp.text}"`);
  });

  // 3. Escolher o melhor template de reativação
  const templateNome = templates.some(t => t.name === 'reativar_contato') 
    ? 'reativar_contato' 
    : (templates.some(t => t.name === 'saudacao_entrada_v3') ? 'saudacao_entrada_v3' : templates[0]?.name);

  if (!templateNome) {
    console.error("Nenhum template disponível para envio!");
    return;
  }

  console.log(`\nSelecionado para envio: "${templateNome}"`);

  // 4. Montar o payload
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

  const targetTemplate = templates.find(t => t.name === templateNome);
  const bodyComponent = (targetTemplate.components || []).find(c => c.type === 'BODY');
  
  if (bodyComponent && bodyComponent.text.includes('{{1}}')) {
    payload.template.components = [
      {
        type: 'body',
        parameters: [
          {
            type: 'text',
            text: 'Hudson' // Nome do cliente
          }
        ]
      }
    ];
  }

  console.log("Enviando requisição de template para a API da Meta...");
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
    console.log(`\nTemplate enviado com sucesso! Meta ID: ${messageId}`);

    // 5. Salvar registro na tabela whatsapp_messages
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

    if (dbError) {
      console.error("Erro ao gravar mensagem no banco:", dbError.message);
    } else {
      console.log("Template gravado com sucesso no histórico whatsapp_messages!");
    }

    // 6. Forçar ia_atendimento_ativo = true no contato
    console.log("Forçando ia_atendimento_ativo = true no banco de dados...");
    const { error: errPiloto } = await supabase
      .from('contatos')
      .update({ ia_atendimento_ativo: true })
      .eq('id', CONTATO_ID);

    if (errPiloto) console.error("Erro ao reativar piloto da Stella:", errPiloto.message);
    else console.log("Piloto automático da Stella reativado e ativo no lead!");

  } else {
    console.error("Erro no envio do template via Meta:", metaData.error?.message || 'Erro desconhecido');
  }
}

main().catch(console.error);
