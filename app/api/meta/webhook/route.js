import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { formatarParaWhatsAppBR } from '@/utils/phoneUtils';

// Cliente Admin (Service Role) — Necessário para operações server-side
const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
};

// --- FUNÇÕES AUXILIARES ---

function sanitizePhone(phone) {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, '');
  if (clean.length === 10 || clean.length === 11) {
    if (!(clean.startsWith('1') && clean.length === 11 && clean[2] !== '9')) {
      clean = '55' + clean;
    }
  }
  return clean || null;
}

// Verifica se o template cadastrado na Meta realmente necessita de parâmetros (ex: {{1}})
async function checkTemplateNeedsVariables(config, templateName) {
  try {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_business_account_id}/message_templates?name=${templateName}&access_token=${config.whatsapp_permanent_token}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[WhatsApp Webhook] Falha ao consultar template '${templateName}' na Meta API (Status: ${res.status}). Usando fallback = true.`);
      return true; 
    }
    const data = await res.json();
    const template = data.data?.find(t => t.name === templateName);
    if (!template) {
      console.warn(`[WhatsApp Webhook] Template '${templateName}' não encontrado na resposta da Meta API. Usando fallback = true.`);
      return true; 
    }

    // Verifica se algum componente de texto tem a variável {{1}}
    let hasVariable = false;
    (template.components || []).forEach(comp => {
      if (comp.text && comp.text.includes('{{1}}')) {
        hasVariable = true;
      }
    });
    return hasVariable;
  } catch (err) {
    console.error(`[WhatsApp Webhook] Erro ao verificar estrutura do template '${templateName}':`, err);
    return true; 
  }
}

// --- FUNÇÃO AUXILIAR: Enviar Template WhatsApp ---
async function sendTemplateMessage(supabaseAdmin, config, to, contato, templateName, language) {
  const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;

  const nomeExibicao = contato?.nome || contato?.razao_social || 'Cliente';

  // Verifica preventivamente se o template realmente usa parâmetros
  const needsVariables = await checkTemplateNeedsVariables(config, templateName);

  const components = [];
  if (needsVariables) {
    components.push({
      type: 'body',
      parameters: [{ type: 'text', text: nomeExibicao }]
    });
  }

  const phoneForMeta = formatarParaWhatsAppBR(to);

  let payload = {
    messaging_product: "whatsapp", to: phoneForMeta, type: "template",
    template: { name: templateName, language: { code: language }, components: components }
  };

  try {
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.whatsapp_permanent_token}`
      },
      body: JSON.stringify(payload)
    });
    
    let responseData = response.status === 204 ? {} : await response.json();

    // Auto-heal (Rede de proteção extra): Se falhar por erro de parâmetros
    if (!response.ok && responseData.error?.code === 132000) {
      console.warn(`⚠️ [WhatsApp Webhook] Detectado erro de parâmetros (132000) para o template '${templateName}'. Tentando reenvio automático sem parâmetros.`);
      
      // Limpa os componentes do payload e reenvia
      payload.template.components = [];

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.whatsapp_permanent_token}`
        },
        body: JSON.stringify(payload)
      });
      responseData = response.status === 204 ? {} : await response.json();
    }

    if (!response.ok) {
      console.error(`❌ [WhatsApp Webhook] Erro API:`, responseData.error?.message);
    } else {
      console.log(`✅ [WhatsApp Webhook] Automação enviada para ${to}`);
      const messageId = responseData.messages?.[0]?.id;
      if (messageId && contato?.id) {
        const { error: insertError } = await supabaseAdmin.from('whatsapp_messages').insert({
          contato_id: contato.id, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to,
          content: `(Automação) Template: ${templateName}`, direction: 'outbound', status: 'sent', raw_payload: payload,
          sent_at: new Date().toISOString(), organizacao_id: config.organizacao_id
        });
        
        if (insertError) {
          console.error(`❌ [WhatsApp Webhook] Erro ao gravar mensagem de boas-vindas no banco:`, insertError.message);
        } else {
          console.log(`✅ [WhatsApp Webhook] Mensagem de boas-vindas gravada no banco para o contato ${contato.id}`);
        }
      }
    }
  } catch (error) {
    console.error(`❌ [WhatsApp Webhook] Erro de rede:`, error);
  }
}

/**
 * Busca a coluna ENTRADA do Funil de Entrada da organizacao.
 * Estrategia em cascata:
 * 1. Funil com is_sistema=true (banco atualizado)
 * 2. Fallback: qualquer coluna tipo_coluna='entrada' da org (banco legado)
 */
async function getOrgEntryColumnId(supabase, orgId) {
  // TENTATIVA 1: Funil com is_sistema=true
  const { data: funilSistema } = await supabase
    .from('funis')
    .select('id')
    .eq('organizacao_id', orgId)
    .eq('is_sistema', true)
    .maybeSingle();

  if (funilSistema) {
    const { data: coluna } = await supabase
      .from('colunas_funil')
      .select('id')
      .eq('funil_id', funilSistema.id)
      .eq('tipo_coluna', 'entrada')
      .maybeSingle();
    if (coluna) {
      console.log(`[Org ${orgId}] ENTRADA via Funil de Entrada (is_sistema=true), coluna id=${coluna.id}`);
      return coluna.id;
    }
  }

  // FALLBACK: qualquer coluna tipo_coluna='entrada' desta org
  const { data: fallback } = await supabase
    .from('colunas_funil')
    .select('id')
    .eq('organizacao_id', orgId)
    .eq('tipo_coluna', 'entrada')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallback) {
    console.warn(`[Org ${orgId}] Fallback: usando coluna ENTRADA por tipo_coluna, id=${fallback.id}.`);
    return fallback.id;
  }

  console.error(`[Org ${orgId}] ERRO: Nenhuma coluna ENTRADA encontrada.`);
  return null;
}

// --- VERIFICACAO DO WEBHOOK (Meta valida a URL) ---
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  if (
    searchParams.get('hub.mode') === 'subscribe' &&
    searchParams.get('hub.verify_token') === process.env.META_VERIFY_TOKEN
  ) {
    return new NextResponse(searchParams.get('hub.challenge'), { status: 200 });
  }
  return new NextResponse(null, { status: 403 });
}

// --- RECEBIMENTO DE LEADS ---
export async function POST(request) {
  // Le o body ANTES de disparar o processamento async.
  // No Next.js App Router, request.body so pode ser lido UMA vez.
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    // 🔥 CORREÇÃO: Aguardamos a execução completa do processamento do lead.
    // Em ambientes serverless (Netlify/AWS), se não usarmos await no processo principal,
    // o container da função desliga assim que a resposta HTTP é enviada, congelando/abortando
    // as chamadas de rede do WhatsApp e os inserts pendentes no banco de dados.
    await processWebhook(body);
  } catch (err) {
    console.error('[WEBHOOK] Erro no processamento do lead:', err.message);
  }
  
  return NextResponse.json({ status: 'received' }, { status: 200 });
}

async function processWebhook(body) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase Admin nao configurado.');

  const change = body.entry?.[0]?.changes?.[0];

  if (change?.field !== 'leadgen') {
    console.log('[WEBHOOK] Evento ignorado (nao e leadgen):', change?.field);
    return;
  }

  const { leadgen_id: leadId, page_id: pageId } = change.value;
  console.log(`[WEBHOOK] Lead recebido: leadId=${leadId}, pageId=${pageId}`);

  // PASSO 1: Descobrir quais organizacoes tem esta pagina integrada
  const { data: integracoes, error: intError } = await supabase
    .from('integracoes_meta')
    .select('organizacao_id, access_token')
    .eq('page_id', pageId);

  if (intError || !integracoes || integracoes.length === 0) {
    console.error(`[WEBHOOK] Pagina ${pageId} sem integracao no sistema. Lead descartado.`);
    return;
  }

  // PASSO 2: Buscar dados completos do lead na API do Meta
  const pageAccessToken = integracoes[0].access_token;
  const leadFields = 'id,field_data,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,is_organic,platform';
  const apiUrl = `https://graph.facebook.com/v20.0/${leadId}?fields=${leadFields}&access_token=${pageAccessToken}`;

  const leadRes = await fetch(apiUrl);
  const leadDetails = await leadRes.json();

  if (leadDetails.error) {
    throw new Error(`[Meta API] ${leadDetails.error.message} (code: ${leadDetails.error.code})`);
  }

  // Monta mapa de campos do formulario
  const formMap = {};
  (leadDetails.field_data || []).forEach(f => { formMap[f.name] = f.values?.[0]; });

  const nomeLead = formMap.full_name || formMap.nome || 'Lead Meta';
  const emailLead = formMap.email || formMap.email_address;
  const phoneLead = formMap.phone_number || formMap.telefone;

  // PASSO 3: Salvar o lead para cada organizacao conectada
  for (const integracao of integracoes) {
    const orgId = integracao.organizacao_id;
    console.log(`[WEBHOOK] Processando para Org ${orgId}...`);

    // 3a. Encontra a coluna ENTRADA do Funil de Entrada desta org
    const colunaEntradaId = await getOrgEntryColumnId(supabase, orgId);
    if (!colunaEntradaId) {
      console.error(`[Org ${orgId}] Sem coluna ENTRADA. Lead ignorado.`);
      continue;
    }

    // 3b. Anti-duplicata: ID unico por org
    const uniqueLeadId = `${leadId}_${orgId}`;
    const { data: existingLead } = await supabase
      .from('contatos')
      .select('id')
      .eq('meta_lead_id', uniqueLeadId)
      .maybeSingle();

    if (existingLead) {
      console.log(`[Org ${orgId}] Lead ${uniqueLeadId} ja existia. Ignorado.`);
      continue;
    }

    // 3b-2. UPSERT Meta Ativos (O Cofre de Anúncios)
    if (leadDetails.campaign_id) {
      await supabase.from('meta_ativos').upsert({ id: leadDetails.campaign_id, organizacao_id: orgId, tipo: 'CAMPAIGN', nome: leadDetails.campaign_name || 'Desconhecido' }, { onConflict: 'id' });
    }
    if (leadDetails.adset_id) {
      await supabase.from('meta_ativos').upsert({ id: leadDetails.adset_id, organizacao_id: orgId, tipo: 'ADSET', nome: leadDetails.adset_name || 'Desconhecido' }, { onConflict: 'id' });
    }
    if (leadDetails.ad_id) {
      await supabase.from('meta_ativos').upsert({ id: leadDetails.ad_id, organizacao_id: orgId, tipo: 'AD', nome: leadDetails.ad_name || 'Desconhecido' }, { onConflict: 'id' });
    }

    // 3c. Cria o contato
    const { data: newContact, error: contactError } = await supabase
      .from('contatos')
      .insert({
        nome: nomeLead,
        origem: leadDetails.is_organic ? 'Meta Lead Organico' : 'Meta Lead Ad',
        tipo_contato: 'Lead',
        personalidade_juridica: 'Pessoa Fisica',
        organizacao_id: orgId,
        meta_lead_id: uniqueLeadId,
        meta_page_id: pageId,
        meta_campaign_id: leadDetails.campaign_id || null,
        meta_campaign_name: leadDetails.campaign_name || null,
        meta_adset_id: leadDetails.adset_id || null,
        meta_adset_name: leadDetails.adset_name || null,
        meta_ad_id: leadDetails.ad_id || null,
        meta_ad_name: leadDetails.ad_name || null,
        meta_form_data: formMap,
      })
      .select('id')
      .single();

    if (contactError) {
      console.error(`[Org ${orgId}] Erro ao criar contato:`, contactError.message);
      continue;
    }

    // 3d. Salva e-mail e telefone
    let finalPhone = null;
    if (emailLead) {
      await supabase.from('emails').insert({ contato_id: newContact.id, email: emailLead, organizacao_id: orgId });
    }
    if (phoneLead) {
      finalPhone = sanitizePhone(phoneLead);
      if (finalPhone) {
        await supabase.from('telefones').insert({ contato_id: newContact.id, telefone: finalPhone, organizacao_id: orgId });
      }
    }

    // 3e. Vincula ao Funil de Entrada -> coluna ENTRADA
    const { data: funilEntry, error: funilError } = await supabase
      .from('contatos_no_funil')
      .insert({ contato_id: newContact.id, coluna_id: colunaEntradaId, organizacao_id: orgId })
      .select('id')
      .single();

    if (funilError) {
      console.error(`[Org ${orgId}] Erro ao vincular ao funil:`, funilError.message);
      continue;
    }

    console.log(`[Org ${orgId}] OK: "${nomeLead}" entregue na coluna ENTRADA (id=${colunaEntradaId}).`);

    let actualColunaId = colunaEntradaId;

    // 3f. AUTOMACAO DE ROTEAMENTO: verifica regras para mover para outro funil
    const { data: roteamentoResult, error: roteamentoError } = await supabase
      .rpc('fn_rotear_lead', { p_contato_no_funil_id: funilEntry.id });

    if (roteamentoError) {
      console.error(`[Org ${orgId}] Erro no roteamento automatico:`, roteamentoError.message);
    } else if (roteamentoResult === 'SEM_REGRA') {
      console.log(`[Org ${orgId}] Nenhuma regra aplicavel. Lead permanece no Funil de Entrada.`);
    } else {
      console.log(`[Org ${orgId}] ROTEADO! Resultado: ${roteamentoResult}`);
      // Busca a coluna_id atualizada após o roteamento
      const { data: updatedCard } = await supabase
        .from('contatos_no_funil')
        .select('coluna_id')
        .eq('id', funilEntry.id)
        .maybeSingle();
      if (updatedCard?.coluna_id) {
        actualColunaId = updatedCard.coluna_id;
      }
    }

    // 3g. AUTOMACAO DE RODIZIO: Atribuir corretor automaticamente
    const { data: configRodizio } = await supabase
      .from('crm_rodizio_config')
      .select('is_active')
      .eq('organizacao_id', orgId)
      .maybeSingle();

    if (configRodizio?.is_active) {
      const { data: rodizioResult, error: rodizioError } = await supabase
        .rpc('fn_distribuir_lead_rodizio', { p_organizacao_id: orgId });

      if (rodizioError) {
        console.error(`[Org ${orgId}] Erro ao buscar corretor no rodizio:`, rodizioError.message);
      } else if (rodizioResult && rodizioResult.length > 0 && rodizioResult[0].contato_id) {
        const corretorAtribuidoId = rodizioResult[0].contato_id;
        const { error: updateError } = await supabase
          .from('contatos_no_funil')
          .update({ corretor_id: corretorAtribuidoId })
          .eq('id', funilEntry.id);
        
        if (updateError) {
          console.error(`[Org ${orgId}] Erro ao vincular corretor do rodizio ao lead:`, updateError.message);
        } else {
          console.log(`[Org ${orgId}] Corretor (contato_id=${corretorAtribuidoId}) atribuido ao lead via Rodizio.`);
        }
      }
    } else {
      console.log(`[Org ${orgId}] Rodizio inativo. Nenhum corretor atribuido automaticamente.`);
    }

    // 3h. AUTOMACAO WHATSAPP (Boas vindas / Criação de Card)
    const { data: automacoes } = await supabase
      .from('automacoes')
      .select('*')
      .eq('organizacao_id', orgId)
      .eq('ativo', true)
      .in('gatilho_tipo', ['CRIAR_CARD', 'MOVER_CARD', 'MOVER_COLUNA'])
      .eq('gatilho_config->>coluna_id', actualColunaId);

    if (automacoes?.length > 0 && finalPhone) {
      const { data: orgConfig } = await supabase.from('configuracoes_whatsapp').select('*').eq('organizacao_id', orgId).single();
      if (orgConfig) {
        for (const regra of automacoes) {
          if (regra.acao_tipo === 'ENVIAR_WHATSAPP') {
            
            const condicoes = regra.gatilho_config?.condicoes;
            if (condicoes) {
              let match = true;
              if (condicoes.tipo && condicoes.tipo.toLowerCase() !== 'lead') match = false;
              
              const origemContato = leadDetails.is_organic ? 'Meta Lead Organico' : 'Meta Lead Ad';
              if (condicoes.origem && condicoes.origem !== origemContato) match = false;
              
              if (condicoes.campanha_id && leadDetails.campaign_id !== condicoes.campanha_id) match = false;

              if (!match) {
                console.log(`⏭️ [Automação Webhook] Contato não atende aos filtros da regra: ${regra.nome}`);
                continue;
              }
            }

            console.log(`🤖 [Automação Webhook] Disparando template: ${regra.acao_config.template_nome}`);
            // Mock contato object for the message
            const contatoObj = { id: newContact.id, nome: nomeLead, razao_social: nomeLead };
            await sendTemplateMessage(supabase, orgConfig, finalPhone, contatoObj, regra.acao_config.template_nome, regra.acao_config.template_idioma);
          }
        }
      }
    }
  }
}