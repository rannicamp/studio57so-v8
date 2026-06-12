// app/api/whatsapp/templates/route.js

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
 const supabaseUser = await createServerClient();
 const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

 if (authError || !user) {
 return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
 }

 const { data: profile } = await supabaseUser.from('usuarios').select('organizacao_id').eq('id', user.id).single();
 if (!profile || !profile.organizacao_id) return NextResponse.json({ error: 'Perfil / Organização não encontrados' }, { status: 404 });

 const supabaseAdmin = getSupabaseAdmin();

 try {
 // 1. Busca as configurações MUILT-TENANT no banco de dados
 const { data: config, error: configError } = await supabaseAdmin
 .from('configuracoes_whatsapp')
 .select('whatsapp_permanent_token, whatsapp_business_account_id')
 .eq('organizacao_id', profile.organizacao_id)
 .limit(1)
 .single();

 if (configError || !config) {
 console.error('Erro ao buscar credenciais do WhatsApp para org:', profile.organizacao_id);
 return NextResponse.json({ error: 'Credenciais do WhatsApp SaaS não configuradas para sua empresa.' }, { status: 500 });
 }


 // 🏆 HIERARQUIA DE TOKEN: env var permanente > banco de dados (pode estar expirado!)
 const WHATSAPP_TOKEN = config.whatsapp_permanent_token || process.env.WHATSAPP_SYSTEM_USER_TOKEN;
 const WHATSAPP_BUSINESS_ACCOUNT_ID = config.whatsapp_business_account_id;

 if (process.env.WHATSAPP_SYSTEM_USER_TOKEN) {
 console.log('🏆 [Templates] Usando token permanente do System User.');
 } else {
 console.warn('⚠️ [Templates] Usando token do banco. Configure WHATSAPP_SYSTEM_USER_TOKEN no Netlify para evitar expiração.');
 }

 // Verifica se o ID da conta de negócios está configurado
 if (!WHATSAPP_BUSINESS_ACCOUNT_ID) {
 return NextResponse.json({ error: 'ID da Conta de Negócios (WABA ID) não configurado.' }, { status: 500 });
 }

 // 2. Monta a URL para a API da Meta
 const url = `https://graph.facebook.com/v20.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=name,status,category,language,components&limit=100`;

 // 3. Chama a API da Meta
 const apiResponse = await fetch(url, {
 method: 'GET',
 headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
 });

 const responseData = await apiResponse.json();

 if (!apiResponse.ok) {
 console.error('Erro da API do WhatsApp ao buscar templates:', responseData);
 return NextResponse.json({ error: `Erro da API do WhatsApp: ${responseData.error?.message}` }, { status: apiResponse.status });
 }

  // 4. Busca as métricas de envio locais usando a RPC de alta performance
  const { data: metricsData, error: metricsError } = await supabaseAdmin
    .rpc('fn_metricas_gerais_templates', { p_organizacao_id: profile.organizacao_id });

  if (metricsError) {
    console.error('Erro ao buscar métricas locais de templates:', metricsError);
  }

  const templateMetricsMap = {};
  if (metricsData) {
    metricsData.forEach(row => {
      templateMetricsMap[row.template_name] = {
        sent: Number(row.total_sent) || 0,
        delivered: Number(row.total_delivered) || 0,
        read: Number(row.total_read) || 0,
        replied: Number(row.total_replied) || 0
      };
    });
  }

  // 5. Filtra apenas os modelos que estão APROVADOS (a menos que 'all=true' seja requisitado) e mescla com as métricas
  const { searchParams } = new URL(request.url);
  const showAll = searchParams.get('all') === 'true';

  const rawTemplates = Array.isArray(responseData?.data) ? responseData.data : [];
  const templatesWithMetrics = rawTemplates.map(template => {
    const localMetrics = templateMetricsMap[template.name] || { sent: 0, delivered: 0, read: 0, replied: 0 };
    return {
      ...template,
      metrics: {
        ...localMetrics,
        read_rate: localMetrics.sent > 0 ? Math.round((localMetrics.read / localMetrics.sent) * 100) : 0,
        reply_rate: localMetrics.sent > 0 ? Math.round((localMetrics.replied / localMetrics.sent) * 100) : 0
      }
    };
  });
  
  if (showAll) {
   return NextResponse.json(templatesWithMetrics);
  } else {
   const approvedTemplates = templatesWithMetrics.filter(template => template.status === 'APPROVED');
   return NextResponse.json(approvedTemplates);
  }

 } catch (error) {
 console.error('Falha crítica ao buscar modelos de mensagem:', error);
 return NextResponse.json({ error: 'Falha crítica ao processar a requisição.', details: error.message }, { status: 500 });
 }
}

export async function POST(request) {
 const supabaseUser = await createServerClient();
 const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

 if (authError || !user) {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
 }

 const { data: profile } = await supabaseUser.from('usuarios').select('organizacao_id').eq('id', user.id).single();
 if (!profile || !profile.organizacao_id) return NextResponse.json({ error: 'Perfil / Organização não encontrados' }, { status: 404 });

 const supabaseAdmin = getSupabaseAdmin();

 try {
  const payload = await request.json();

  const { data: config, error: configError } = await supabaseAdmin
  .from('configuracoes_whatsapp')
  .select('whatsapp_permanent_token, whatsapp_business_account_id')
  .eq('organizacao_id', profile.organizacao_id)
  .limit(1)
  .single();

  if (configError || !config) {
   return NextResponse.json({ error: 'Credenciais do WhatsApp SaaS não configuradas.' }, { status: 500 });
  }

  const WHATSAPP_TOKEN = config.whatsapp_permanent_token || process.env.WHATSAPP_SYSTEM_USER_TOKEN;
  const WHATSAPP_BUSINESS_ACCOUNT_ID = config.whatsapp_business_account_id;

  if (!WHATSAPP_BUSINESS_ACCOUNT_ID) {
   return NextResponse.json({ error: 'ID da Conta de Negócios (WABA ID) não configurado.' }, { status: 500 });
  }

  // Processar cabeçalho de imagem, se houver
  const APP_ID = '2052352668968564'; // SaaS App ID
  if (payload.components) {
    for (let comp of payload.components) {
      if (comp.type === 'HEADER' && comp.format === 'IMAGE' && comp.__localImage) {
        const { base64, mime } = comp.__localImage;
        const buffer = Buffer.from(base64, 'base64');

        // 1. Iniciar sessão de upload na Meta
        const sessionUrl = `https://graph.facebook.com/v20.0/${APP_ID}/uploads?file_length=${buffer.length}&file_type=${encodeURIComponent(mime)}`;
        const sessionRes = await fetch(sessionUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
        });
        const sessionData = await sessionRes.json();

        if (!sessionRes.ok || !sessionData.id) {
          throw new Error('Falha ao iniciar sessão de upload de imagem na Meta: ' + (sessionData.error?.message || 'Erro desconhecido'));
        }

        // 2. Fazer upload do arquivo
        const uploadUrl = `https://graph.facebook.com/v20.0/${sessionData.id}`;
        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            'file_offset': '0'
          },
          body: buffer
        });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok || !uploadData.h) {
          throw new Error('Falha ao enviar imagem para a Meta: ' + (uploadData.error?.message || 'Erro desconhecido'));
        }

        // 3. Atualizar o componente com o header_handle
        comp.example = {
          header_handle: [uploadData.h]
        };
        
        // Remove os dados locais para não enviar para a Meta
        delete comp.__localImage;
      }
    }
  }

  const url = `https://graph.facebook.com/v20.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;

  const apiResponse = await fetch(url, {
   method: 'POST',
   headers: { 
    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json'
   },
   body: JSON.stringify(payload)
  });

  const responseData = await apiResponse.json();

  if (!apiResponse.ok) {
   console.error('Erro da API do WhatsApp ao criar template:', responseData);
   const metaErrorMsg = responseData.error?.error_user_msg || responseData.error?.message || 'Falha desconhecida.';
   return NextResponse.json({ error: metaErrorMsg }, { status: apiResponse.status });
  }

  return NextResponse.json(responseData);

 } catch (error) {
  console.error('Falha crítica ao criar modelo de mensagem:', error);
  return NextResponse.json({ error: 'Falha crítica ao processar a requisição.', details: error.message }, { status: 500 });
 }
}

export async function DELETE(request) {
 const supabaseUser = await createServerClient();
 const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

 if (authError || !user) {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
 }

 const { data: profile } = await supabaseUser.from('usuarios').select('organizacao_id').eq('id', user.id).single();
 if (!profile || !profile.organizacao_id) return NextResponse.json({ error: 'Perfil / Organização não encontrados' }, { status: 404 });

 const supabaseAdmin = getSupabaseAdmin();

 try {
  const { searchParams } = new URL(request.url);
  const templateName = searchParams.get('name');

  if (!templateName) {
   return NextResponse.json({ error: 'Nome do template não fornecido.' }, { status: 400 });
  }

  const { data: config, error: configError } = await supabaseAdmin
  .from('configuracoes_whatsapp')
  .select('whatsapp_permanent_token, whatsapp_business_account_id')
  .eq('organizacao_id', profile.organizacao_id)
  .limit(1)
  .single();

  if (configError || !config) {
   return NextResponse.json({ error: 'Credenciais do WhatsApp SaaS não configuradas.' }, { status: 500 });
  }

  const WHATSAPP_TOKEN = config.whatsapp_permanent_token || process.env.WHATSAPP_SYSTEM_USER_TOKEN;
  const WHATSAPP_BUSINESS_ACCOUNT_ID = config.whatsapp_business_account_id;

  if (!WHATSAPP_BUSINESS_ACCOUNT_ID) {
   return NextResponse.json({ error: 'ID da Conta de Negócios (WABA ID) não configurado.' }, { status: 500 });
  }

  const url = `https://graph.facebook.com/v20.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?name=${templateName}`;

  const apiResponse = await fetch(url, {
   method: 'DELETE',
   headers: { 
    'Authorization': `Bearer ${WHATSAPP_TOKEN}`
   }
  });

  const responseData = await apiResponse.json();

  if (!apiResponse.ok) {
   console.error('Erro da API do WhatsApp ao EXCLUIR template:', responseData);
   return NextResponse.json({ error: `Erro da API da Meta: ${responseData.error?.message || 'Falha ao excluir template.'}` }, { status: apiResponse.status });
  }

  return NextResponse.json({ success: true, message: 'Template excluído com sucesso.' });

 } catch (error) {
  console.error('Falha crítica ao excluir modelo de mensagem:', error);
  return NextResponse.json({ error: 'Falha crítica ao processar a requisição.', details: error.message }, { status: 500 });
 }
}