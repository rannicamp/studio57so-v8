// scratch/recuperar_viviane.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Projetos/studio57so-v8/.env.local' });
const { formatarParaWhatsAppBR } = require('../utils/phoneUtils');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COLUNA_MSG_ENVIADA_ORG2 = '660662df-a1e1-411f-9c2c-0907fce46126';
const TEMPLATE_NOME = 'saudacao_entrada_v3';
const TEMPLATE_IDIOMA = 'pt_BR';

async function main() {
  console.log("=== RECUPERAÇÃO INDIVIDUAL: VIVIANE MARQUES ===");

  try {
    const { data: config } = await supabase
      .from('configuracoes_whatsapp')
      .select('*')
      .eq('organizacao_id', 2)
      .single();

    const { data: contact } = await supabase
      .from('contatos')
      .select('*')
      .eq('id', 5769)
      .single();

    const { data: funil } = await supabase
      .from('contatos_no_funil')
      .select('id')
      .eq('contato_id', 5769)
      .maybeSingle();

    if (!config || !contact) {
      console.error("Configuração ou contato não encontrados.");
      return;
    }

    const phone = "5533987396848";
    const phoneForMeta = formatarParaWhatsAppBR(phone);

    console.log(`Enviando template para Viviane Marques (${phone})...`);
    
    // Tenta reenvio sem parâmetros (conforme o auto-heal validado)
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to: phoneForMeta,
      type: "template",
      template: {
        name: TEMPLATE_NOME,
        language: { code: TEMPLATE_IDIOMA },
        components: [] // direto sem parâmetros
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.whatsapp_permanent_token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Erro no envio:", data.error?.message);
      return;
    }

    console.log("🟢 WhatsApp enviado com sucesso! Message ID:", data.messages?.[0]?.id);

    // Gravar mensagem
    await supabase.from('whatsapp_messages').insert({
      contato_id: 5769,
      message_id: data.messages[0].id,
      sender_id: config.whatsapp_phone_number_id,
      receiver_id: phone,
      content: `(Automação Recuperação) Template: ${TEMPLATE_NOME}`,
      direction: 'outbound',
      status: 'sent',
      raw_payload: payload,
      sent_at: new Date().toISOString(),
      organizacao_id: 2
    });

    // Reativar IA
    await supabase.from('contatos').update({ ia_atendimento_ativo: true }).eq('id', 5769);
    console.log("🤖 Piloto automático reativado.");

    // Mover funil
    if (funil) {
      await supabase.from('contatos_no_funil').update({
        coluna_id: COLUNA_MSG_ENVIADA_ORG2,
        updated_at: new Date().toISOString()
      }).eq('id', funil.id);
      console.log("🟢 Card movido para MENSAGEM ENVIADA.");

      await supabase.from('crm_notas').insert({
        contato_id: 5769,
        contato_no_funil_id: funil.id,
        conteudo: `🤖 [Recuperação Individual] Mensagem de boas-vindas enviada após saneamento de falha antiga de API. Card movido para "MENSAGEM ENVIADA". Piloto automático ativado.`,
        organizacao_id: 2
      });
    }

    console.log("Recuperação concluída com sucesso!");

  } catch (err) {
    console.error(err);
  }
}

main();
