// Caminho: app/meta/webhook/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enviarNotificacao } from '@/utils/notificacoes'; 

// --- CONFIGURAÇÃO DO CLIENTE ADMIN ---
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY; 
    
    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ ERRO CRÍTICO: Variáveis de ambiente SUPABASE_URL ou SUPABASE_SECRET_KEY faltando.");
        return null;
    }
    return createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
    });
};

// --- FUNÇÕES AUXILIARES ---

// 1. Limpeza de Telefone
function sanitizePhone(phone) {
    if (!phone) return null;
    let clean = phone.replace(/\D/g, ''); 
    if (clean.length === 10 || clean.length === 11) {
        if (clean.startsWith('1') && clean.length === 11 && clean[2] !== '9') {
             // Provável EUA
        } else {
             clean = '55' + clean;
        }
    }
    return clean;
}

// 2. Busca nomes de Campanhas/Anúncios
async function getMetaObjectName(objectId) {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!objectId || !accessToken) return null;
    try {
        const url = `https://graph.facebook.com/v20.0/${objectId}?fields=name&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();
        return response.ok ? data.name : null;
    } catch (error) {
        return null;
    }
}

// 3. Descobre a Organização
async function getOrganizationIdByPageId(supabase, pageId) {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!accessToken) throw new Error("Token Meta não configurado.");

    const url = `https://graph.facebook.com/v20.0/${pageId}?fields=business&access_token=${accessToken}`;
    const metaResponse = await fetch(url);
    const metaData = await metaResponse.json();
    
    // Se não tiver Business ID, tenta buscar direto pelo page_id no banco
    if (!metaData.business?.id) {
        const { data: empresaDireta } = await supabase.from('cadastro_empresa').select('organizacao_id').eq('meta_page_id', pageId).single();
        if (empresaDireta) return empresaDireta.organizacao_id;
        throw new Error(`Página ${pageId} sem Business Manager.`);
    }

    const { data: empresa } = await supabase.from('cadastro_empresa').select('organizacao_id').eq('meta_business_id', metaData.business.id).single();
    if (!empresa) throw new Error(`Business ID ${metaData.business.id} não encontrado.`);
    
    return empresa.organizacao_id;
}

// 4. Garante Funil
async function ensureFunilAndFirstColumn(supabase, organizacaoId) {
    let { data: funil } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').eq('organizacao_id', organizacaoId).single();
    if (!funil) {
        const { data: newFunil } = await supabase.from('funis').insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId }).select('id').single();
        funil = newFunil;
    }
    let { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem', { ascending: true }).limit(1).single();
    if (!primeiraColuna) {
        const { data: newColuna } = await supabase.from('colunas_funil').insert({ funil_id: funil.id, nome: 'Novos Leads', ordem: 0, organizacao_id: organizacaoId }).select('id').single();
        primeiraColuna = newColuna;
    }
    return primeiraColuna.id;
}

// 5. Busca Equipe Comercial para Notificar
async function getEquipeComercial(supabase, organizacaoId) {
    const { data: funcoes } = await supabase.from('funcoes')
        .select('id')
        .in('nome_funcao', ['Proprietário', 'Proprietario', 'Comercial', 'Vendedor', 'Corretor', 'Admin'])
        .eq('organizacao_id', organizacaoId); 
    
    if (!funcoes?.length) return [];
    const funcoesIds = funcoes.map(f => f.id);
    
    const { data: users } = await supabase.from('usuarios')
        .select('id')
        .in('funcao_id', funcoesIds)
        .eq('is_active', true)
        .eq('organizacao_id', organizacaoId);
        
    return users || [];
}

// ==============================================================================
// WEBHOOK VERIFICATION (GET)
// ==============================================================================
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');
    
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse('Token inválido', { status: 403 });
}

// ==============================================================================
// RECEIVE DATA (POST)
// ==============================================================================
export async function POST(request) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return new NextResponse(JSON.stringify({ status: 'error', message: 'Configuração incompleta.' }), { status: 500 });
    
    let contatoIdParaLimpeza = null;

    try {
        const body = await request.json();
        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];

        if (change?.field !== 'leadgen') {
            return new NextResponse(JSON.stringify({ status: 'ignored' }), { status: 200 });
        }
        
        const { leadgen_id: leadId, page_id: pageId, form_id: formId, created_time: createdTime } = change.value;
        const adId = change.value.ad_id || null;
        const adsetId = change.value.adgroup_id || null; 
        const campaignId = change.value.campaign_id || null;
        
        // Verifica Duplicidade
        const { data: existingLead } = await supabase.from('contatos').select('id').eq('meta_lead_id', leadId).single();
        if (existingLead) return new NextResponse(JSON.stringify({ status: 'lead_exists' }), { status: 200 });
        
        // Identifica Organização
        const organizacaoId = await getOrganizationIdByPageId(supabase, pageId);
        
        // --- AQUI ESTAVA A MÁGICA: SINCRONIZA NOMES ANTES ---
        let campaignName = null, adsetName = null, adName = null;
        if (campaignId) {
            campaignName = await getMetaObjectName(campaignId);
            await supabase.from('meta_campaigns').upsert({ id: campaignId, name: campaignName, organizacao_id: organizacaoId }, { onConflict: 'id' }).catch(() => {});
        }
        if (adsetId) {
            adsetName = await getMetaObjectName(adsetId);
            await supabase.from('meta_adsets').upsert({ id: adsetId, name: adsetName, campaign_id: campaignId, organizacao_id: organizacaoId }, { onConflict: 'id' }).catch(() => {});
        }
        if (adId) {
            adName = await getMetaObjectName(adId);
            await supabase.from('meta_ads').upsert({ id: adId, name: adName, campaign_id: campaignId, adset_id: adsetId, organizacao_id: organizacaoId }, { onConflict: 'id' }).catch(() => {});
        }

        // --- CORREÇÃO PRINCIPAL: URL LIMPA ---
        // Pedimos apenas os campos essenciais que o Lead REALMENTE tem.
        const leadRes = await fetch(`https://graph.facebook.com/v20.0/${leadId}?fields=created_time,id,ad_id,form_id,field_data&access_token=${process.env.META_PAGE_ACCESS_TOKEN}`);
        const leadDetails = await leadRes.json();
        
        if (!leadRes.ok) {
            throw new Error(leadDetails.error?.message || "Erro API Meta");
        }

        const formMap = {};
        leadDetails.field_data?.forEach(f => { formMap[f.name] = f.values[0]; });
        
        // Mapeamento Inteligente
        const nomeLead = formMap.full_name || formMap.nome_completo || formMap.nome || formMap.name || `Lead Meta (${new Date().toLocaleDateString()})`;
        const emailLead = formMap.email || formMap.email_comercial || formMap.work_email;
        const phoneLead = formMap.phone_number || formMap.telefone || formMap.whatsapp || formMap.celular;

        // CRIA O CONTATO
        const { data: newContact, error: contactError } = await supabase.from('contatos').insert({
            nome: nomeLead,
            origem: adName ? `Meta Ads - ${adName}` : 'Meta Lead Ads',
            tipo_contato: 'Lead',
            personalidade_juridica: 'Pessoa Física',
            organizacao_id: organizacaoId,
            meta_lead_id: leadId,
            meta_ad_id: adId,
            meta_campaign_id: campaignId,
            meta_adgroup_id: adsetId,
            meta_page_id: pageId,
            meta_form_id: formId,
            meta_created_time: new Date((createdTime || Date.now() / 1000) * 1000).toISOString(),
            meta_form_data: formMap,
            // Aqui usamos as variáveis que buscamos lá em cima
            meta_ad_name: adName,
            meta_campaign_name: campaignName,
            meta_adset_name: adsetName
        }).select('id').single();

        if (contactError) throw new Error(contactError.message);
        contatoIdParaLimpeza = newContact.id;

        // Salva Email
        if (emailLead) {
            await supabase.from('emails').insert({ 
                contato_id: newContact.id, email: emailLead, tipo: 'Principal', organizacao_id: organizacaoId 
            });
        }
        
        // Salva Telefone
        if (phoneLead) {
            const finalPhone = sanitizePhone(phoneLead);
            if (finalPhone) {
                await supabase.from('telefones').insert({ 
                    contato_id: newContact.id, telefone: finalPhone, tipo: 'Celular', organizacao_id: organizacaoId 
                });
            }
        }
        
        // Coloca no Funil
        const colunaId = await ensureFunilAndFirstColumn(supabase, organizacaoId);
        await supabase.from('contatos_no_funil').insert({ 
            contato_id: newContact.id, coluna_id: colunaId, organizacao_id: organizacaoId, numero_card: 1 
        });
        
        // Notificações
        try {
            const equipe = await getEquipeComercial(supabase, organizacaoId);
            if (equipe.length > 0) {
                const promises = equipe.map(user => 
                    enviarNotificacao({
                        userId: user.id,
                        titulo: '🚀 Novo Lead Chegou!',
                        mensagem: `${nomeLead} chegou via ${adName || 'Anúncio'}.`,
                        link: `/crm/funil`,
                        tipo: 'sucesso',
                        organizacao_id: organizacaoId,
                        canal: 'sistema',
                        supabaseClient: supabase
                    })
                );
                await Promise.all(promises);
            }
        } catch (notifErr) { console.error('Erro notificação:', notifErr); }

        return new NextResponse(JSON.stringify({ status: 'success', id: newContact.id }), { status: 200 });

    } catch (e) {
        console.error('❌ [WEBHOOK ERRO]', e.message);
        if (contatoIdParaLimpeza) {
            await supabase.from('contatos').delete().eq('id', contatoIdParaLimpeza);
        }
        return new NextResponse(JSON.stringify({ status: 'error', message: e.message }), { status: 500 }); 
    }
}