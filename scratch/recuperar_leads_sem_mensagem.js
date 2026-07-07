// scratch/recuperar_leads_sem_mensagem.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });
const { formatarParaWhatsAppBR } = require('../utils/phoneUtils');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configurações Globais
const COLUNA_MSG_ENVIADA_ORG2 = '660662df-a1e1-411f-9c2c-0907fce46126';
const TEMPLATE_NOME = 'saudacao_entrada_v3';
const TEMPLATE_IDIOMA = 'pt_BR';

// Função para formatar o telefone no formato da Meta
function formatPhoneForMeta(phone) {
  return formatarParaWhatsAppBR(phone);
}

// Enviar Template WhatsApp via Graph API
async function sendTemplate(config, to, contatoNome, templateName, language) {
  const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
  const phoneForMeta = formatPhoneForMeta(to);

  // O template saudacao_entrada_v3 precisa de 1 parâmetro (o nome do cliente)
  const payload = {
    messaging_product: "whatsapp",
    to: phoneForMeta,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: contatoNome || 'Cliente' }
          ]
        }
      ]
    }
  };

  try {
    let res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.whatsapp_permanent_token}`
      },
      body: JSON.stringify(payload)
    });

    let data = await res.json();

    // Auto-heal para erro 132000 (Mismatch de parâmetros)
    if (!res.ok && data.error?.code === 132000) {
      console.warn(`⚠️ [WhatsApp Recovery Auto-heal] Detectado erro de parâmetros (132000) para o template '${templateName}'. Tentando reenvio sem parâmetros.`);
      
      payload.template.components = [];

      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.whatsapp_permanent_token}`
        },
        body: JSON.stringify(payload)
      });
      data = await res.json();
    }

    if (!res.ok) {
      console.error(`❌ Erro no envio do WhatsApp para ${to}:`, data.error?.message);
      return { success: false, error: data.error?.message, payload };
    }

    return { success: true, messageId: data.messages?.[0]?.id, payload };
  } catch (err) {
    console.error(`❌ Erro de rede para ${to}:`, err.message);
    return { success: false, error: err.message, payload: null };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isTestMode = args.includes('--test');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  console.log("=== INICIANDO RECUPERAÇÃO DE LEADS TRAVADOS ===");
  if (isTestMode) {
    console.log("⚠️ MODO DE TESTE ATIVADO! Enviando apenas para o número de teste do Ranniere.");
  } else if (limit) {
    console.log(`⚠️ LIMITANDO O ENVIO A ${limit} LEADS.`);
  }

  try {
    // 1. Carregar configuração do WhatsApp da Org 2 (Studio 57)
    const { data: config, error: errConf } = await supabase
      .from('configuracoes_whatsapp')
      .select('*')
      .eq('organizacao_id', 2)
      .single();

    if (errConf || !config) {
      console.error("Erro ao obter configurações do WhatsApp:", errConf?.message);
      return;
    }

    console.log(`Configuração do WhatsApp encontrada. Conta: ${config.whatsapp_phone_number_id}`);

    // 2. Buscar dados da auditoria (diagnostico_entrada_geral.json)
    const diagnosticoPath = path.join(__dirname, 'diagnostico_entrada_geral.json');
    if (!fs.existsSync(diagnosticoPath)) {
      console.error("Arquivo diagnostico_entrada_geral.json não encontrado. Rode a auditoria primeiro.");
      return;
    }

    const analise = JSON.parse(fs.readFileSync(diagnosticoPath, 'utf-8'));
    const leadsSemMensagem = analise.filter(a => a.total_mensagens === 0);

    console.log(`Leads travados na Entrada sem nenhuma mensagem: ${leadsSemMensagem.length}`);

    // Filtrar leads que possuem telefone vinculado
    // Vamos buscar os telefones destes contatos
    const contatoIds = leadsSemMensagem.map(l => l.contato_id);
    const { data: telefones, error: errT } = await supabase
      .from('telefones')
      .select('contato_id, telefone')
      .in('contato_id', contatoIds);

    if (errT) {
      console.error("Erro ao buscar telefones:", errT.message);
      return;
    }

    const telefonesMap = new Map(telefones.map(t => [t.contato_id, t.telefone]));

    const leadsParaEnviar = leadsSemMensagem.filter(l => telefonesMap.has(l.contato_id)).map(l => ({
      ...l,
      telefone: telefonesMap.get(l.contato_id)
    }));

    console.log(`Leads aptos para envio (possuem telefone): ${leadsParaEnviar.length}`);

    if (leadsParaEnviar.length === 0 && !isTestMode) {
      console.log("Nenhum lead apto para envio.");
      return;
    }

    // 3. Execução do Envio
    let alvos = [];
    if (isTestMode) {
      // Usar dados fictícios direcionados para o número de teste
      alvos = [{
        contato_id: 999999, // ID fictício
        card_id: null,
        nome: "Ranniere Teste",
        telefone: "5533991912291",
        organizacao_id: 2
      }];
    } else {
      alvos = limit ? leadsParaEnviar.slice(0, limit) : leadsParaEnviar;
    }

    console.log(`\nIniciando envios para ${alvos.length} alvos...`);

    for (let i = 0; i < alvos.length; i++) {
      const lead = alvos[i];
      console.log(`\n[${i+1}/${alvos.length}] Processando: ${lead.nome} | Fone: ${lead.telefone}...`);

      // Envia o template
      const res = await sendTemplate(config, lead.telefone, lead.nome, TEMPLATE_NOME, TEMPLATE_IDIOMA);

      if (res.success) {
        console.log(`🟢 WhatsApp enviado com sucesso! MessageID: ${res.messageId}`);

        if (!isTestMode) {
          // Gravar registro na tabela whatsapp_messages
          const { error: errIns } = await supabase
            .from('whatsapp_messages')
            .insert({
              contato_id: lead.contato_id,
              message_id: res.messageId,
              sender_id: config.whatsapp_phone_number_id,
              receiver_id: lead.telefone,
              content: `(Automação Recuperação) Template: ${TEMPLATE_NOME}`,
              direction: 'outbound',
              status: 'sent',
              raw_payload: res.payload,
              sent_at: new Date().toISOString(),
              organizacao_id: 2
            });

          if (errIns) {
            console.error(`❌ Erro ao gravar mensagem no banco para ${lead.nome}:`, errIns.message);
          } else {
            console.log(`🟢 Mensagem gravada no banco de dados.`);
          }

          // Ativar piloto automático Stella
          await supabase
            .from('contatos')
            .update({ ia_atendimento_ativo: true })
            .eq('id', lead.contato_id);
          console.log(`🤖 Piloto automático reativado.`);

          // Mover no funil para MENSAGEM ENVIADA
          if (lead.card_id) {
            const { error: errMov } = await supabase
              .from('contatos_no_funil')
              .update({
                coluna_id: COLUNA_MSG_ENVIADA_ORG2,
                updated_at: new Date().toISOString()
              })
              .eq('id', lead.card_id);

            if (errMov) {
              console.error(`❌ Erro ao mover no funil:`, errMov.message);
            } else {
              console.log(`🟢 Card movido para MENSAGEM ENVIADA.`);

              // Gravar nota no CRM
              await supabase.from('crm_notas').insert({
                contato_id: lead.contato_id,
                contato_no_funil_id: lead.card_id,
                conteudo: `🤖 [Recuperação de Leads] Mensagem de boas-vindas disparada manualmente via script de recuperação (Template: ${TEMPLATE_NOME}). Card movido para "MENSAGEM ENVIADA". Piloto automático ativado.`,
                organizacao_id: 2
              });
            }
          }
        }
      } else {
        console.error(`❌ Falha ao enviar para ${lead.nome}: ${res.error}`);
        
        if (!isTestMode) {
          // Gravar registro de erro para auditoria posterior
          await supabase
            .from('whatsapp_messages')
            .insert({
              contato_id: lead.contato_id,
              sender_id: config.whatsapp_phone_number_id,
              receiver_id: lead.telefone,
              content: `(Falha Recuperação) Template: ${TEMPLATE_NOME}`,
              direction: 'outbound',
              status: 'failed',
              error_message: res.error,
              sent_at: new Date().toISOString(),
              organizacao_id: 2
            });
        }
      }

      // Pequeno delay entre disparos para não sobrecarregar
      if (i < alvos.length - 1) {
        console.log("Aguardando 1.5 segundos para o próximo disparo...");
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    console.log("\n🟢 PROCESSO DE ENVIOS DE RECUPERAÇÃO CONCLUÍDO!");

  } catch (err) {
    console.error("Erro geral no script:", err);
  }
}

main();
