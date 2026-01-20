// Caminho: app/meta/webhook/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enviarNotificacao } from '@/utils/notificacoes'; // Certifique-se que este arquivo existe

// --- CONFIGURAÇÃO DO CLIENTE ADMIN (Modo Deus) ---
// Precisamos disso porque o Facebook não é um usuário logado.
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY; // A chave SERVICE_ROLE (Começa com ey...)
    
    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ ERRO CRÍTICO: Variáveis de ambiente SUPABASE_URL ou SUPABASE_SECRET_KEY faltando.");
        return null;
    }
    return createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
    });
};

// --- FUNÇÕES AUXILIARES (A Lógica Inteligente) ---

// 1. Limpeza de Telefone (Padrão Brasil +55)
function sanitizePhone(phone) {
    if (!phone) return null;
    let clean = phone.replace(/\D/g, ''); 
    if (clean.length === 10 || clean.length === 11) {
        // Se não começar com código de país, assume Brasil
        if (clean.startsWith('1') && clean.length === 11 && clean[2] !== '9') {
             // Provável EUA, mantém
        } else {
             clean = '55' + clean;
        }
    }
    return clean;
}

// 2. Busca nomes de Campanhas/Anúncios no Facebook
async function getMetaObjectName(objectId) {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!objectId || !accessToken) return null;
    try {
        const url = `https://graph.facebook.com/v20.0/${objectId}?fields=name&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();
        return response.ok ? data.name : null;
    } catch (error) {
        console.error(`Erro ao buscar nome do objeto ${objectId}:`, error);
        return null;
    }
}

// 3. Descobre qual Organização do Studio 57 é dona dessa Página do Facebook
async function getOrganizationIdByPageId(supabase, pageId) {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!accessToken) throw new Error("Token Meta (META_PAGE_ACCESS_TOKEN) não configurado no .env");

    // Primeiro: Descobrir o Business ID dono da página
    const url = `https://graph.facebook.com/v20.0/${pageId}?fields=business&access_token=${accessToken}`;
    const metaResponse = await fetch(url);
    const metaData = await metaResponse.json();
    
    if (!metaData.business?.id) {
        // Fallback: Se não tiver Business Manager, tenta achar a organização que cadastrou essa page_id diretamente (se houver essa lógica)
        // Por segurança, vamos lançar erro para você saber que a página precisa estar num Business Manager
        console.warn(`⚠️ Página ${pageId} sem Business Manager vinculado na Meta API.`);
        // Tenta buscar direto na tabela se você salvou o page_id lá, senão falha.
        const { data: empresaDireta } = await supabase.from('cadastro_empresa').select('organizacao_id').eq('meta_page_id', pageId).single();
        if (empresaDireta) return empresaDireta.organizacao_id;

        throw new Error(`Página ${pageId} sem Business Manager e não encontrada diretamente no banco.`);
    }

    // Busca qual empresa no seu banco tem esse Business ID
    const { data: empresa } = await supabase.from('cadastro_empresa').select('organizacao_id').eq('meta_business_id', metaData.business.id).single();
    
    if (!empresa) {
        // Tenta fallback: Buscar a primeira organização (SÓ USE ISSO SE TIVER APENAS 1 CLIENTE NO SISTEMA)
        // const { data: orgFallback } = await supabase.from('organizacoes').select('id').limit(1).single();
        // return orgFallback.id;
        throw new Error(`Business ID ${metaData.business.id} não encontrado na tabela cadastro_empresa.`);
    }
    
    return empresa.organizacao_id;
}

// 4. Garante que o Funil e a Coluna existam
async function ensureFunilAndFirstColumn(supabase, organizacaoId) {
    // Busca ou cria Funil de Vendas
    let { data: funil } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').eq('organizacao_id', organizacaoId).single();
    if (!funil) {
        const { data: newFunil } = await supabase.from('funis').insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId }).select('id').single();
        funil = newFunil;
    }
    
    // Busca ou cria primeira coluna
    let { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem', { ascending: true }).limit(1).single();
    if (!primeiraColuna) {
        const { data: newColuna } = await supabase.from('colunas_funil').insert({ funil_id: funil.id, nome: 'Novos Leads', ordem: 0, organizacao_id: organizacaoId }).select('id').single();
        primeiraColuna = newColuna;
    }
    return primeiraColuna.id;
}

// 5. Busca quem deve receber notificação (Equipe Comercial)
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
// 1. VERIFICAÇÃO DO WEBHOOK (GET)
// ==============================================================================
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');
    
    // Pegar token do .env ou usar valor fixo antigo como fallback
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'studio57_token_secreto';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ [Webhook] Verificado com sucesso!');
        return new NextResponse(challenge, { status: 200 });
    }

    return new NextResponse('Token inválido', { status: 403 });
}

// ==============================================================================
// 2. RECEBIMENTO DOS DADOS (POST)
// ==============================================================================
export async function POST(request) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return new NextResponse(JSON.stringify({ status: 'error', message: 'Configuração de Servidor incompleta (Falta Secret Key).' }), { status: 500 });
    
    let contatoIdParaLimpeza = null;

    try {
        const body = await request.json();
        console.log('📨 [Webhook] Recebido:', JSON.stringify(body));

        // Pega a primeira mudança (o Facebook pode mandar lote, mas geralmente manda um por vez em tempo real)
        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];

        if (change?.field !== 'leadgen') {
            return new NextResponse(JSON.stringify({ status: 'ignored', reason: 'Not a leadgen event' }), { status: 200 });
        }
        
        const { leadgen_id: leadId, page_id: pageId, form_id: formId, created_time: createdTime } = change.value;
        // Tenta pegar metadados se vierem no payload, senão serão undefined
        const adId = change.value.ad_id || null;
        const adsetId = change.value.adgroup_id || null; 
        const campaignId = change.value.campaign_id || null;
        
        // 1. Verifica Duplicidade (Para não criar lead repetido do mesmo clique)
        const { data: existingLead } = await supabase.from('contatos').select('id').eq('meta_lead_id', leadId).single();
        if (existingLead) {
            console.log('🔁 [Webhook] Lead já existe. Ignorando.');
            return new NextResponse(JSON.stringify({ status: 'lead_exists' }), { status: 200 });
        }
        
        // 2. Identifica a Organização dona dessa página
        const organizacaoId = await getOrganizationIdByPageId(supabase, pageId);
        console.log(`🏢 [Webhook] Lead pertence à Organização ID: ${organizacaoId}`);
        
        // 3. Sincroniza Metadados (Nomes de Campanha, Adset, Ad)
        // Isso é o que faltava no novo código!
        let campaignName = null, adsetName = null, adName = null;
        
        if (campaignId) {
            campaignName = await getMetaObjectName(campaignId);
            // Salva na tabela auxiliar para estatísticas futuras
            await supabase.from('meta_campaigns').upsert({ id: campaignId, name: campaignName, organizacao_id: organizacaoId }, { onConflict: 'id' }).catch(err => console.error('Erro sync campaign:', err));
        }
        if (adsetId) {
            adsetName = await getMetaObjectName(adsetId);
            await supabase.from('meta_adsets').upsert({ id: adsetId, name: adsetName, campaign_id: campaignId, organizacao_id: organizacaoId }, { onConflict: 'id' }).catch(err => console.error('Erro sync adset:', err));
        }
        if (adId) {
            adName = await getMetaObjectName(adId);
            await supabase.from('meta_ads').upsert({ id: adId, name: adName, campaign_id: campaignId, adset_id: adsetId, organizacao_id: organizacaoId }, { onConflict: 'id' }).catch(err => console.error('Erro sync ad:', err));
        }

        // 4. Busca os dados DE FATO do Lead na Graph API (Nome, Email, Telefone)
        const fields = 'created_time,id,ad_id,form_id,field_data,campaign_name,adset_name,ad_name,form_name';
        const leadRes = await fetch(`https://graph.facebook.com/v20.0/${leadId}?fields=${fields}&access_token=${process.env.META_PAGE_ACCESS_TOKEN}`);
        const leadDetails = await leadRes.json();
        
        if (!leadRes.ok) {
            throw new Error(leadDetails.error?.message || "Erro ao buscar detalhes do lead na Meta API");
        }

        // Mapeia os campos estranhos do Facebook para um objeto simples
        // Ex: [{name: "full_name", values: ["João"]}] -> { full_name: "João" }
        const formMap = {};
        leadDetails.field_data?.forEach(f => { formMap[f.name] = f.values[0]; });
        
        // Tenta encontrar campos comuns, independente de como o formulário foi criado
        const nomeLead = formMap.full_name || formMap.nome_completo || formMap.nome || `Lead Meta (${new Date().toLocaleDateString()})`;
        const emailLead = formMap.email || formMap.email_comercial;
        const phoneLead = formMap.phone_number || formMap.telefone || formMap.whatsapp;

        // 5. CRIA O CONTATO (Com todas as informações ricas)
        const { data: newContact, error: contactError } = await supabase.from('contatos').insert({
            nome: nomeLead,
            origem: adName ? `Meta Ads - ${adName}` : 'Meta Lead Ads', // Origem mais precisa
            tipo_contato: 'Lead',
            personalidade_juridica: 'Pessoa Física',
            organizacao_id: organizacaoId,
            // IDs da Meta para rastreio
            meta_lead_id: leadId,
            meta_ad_id: adId,
            meta_campaign_id: campaignId,
            meta_adgroup_id: adsetId,
            meta_page_id: pageId,
            meta_form_id: formId,
            meta_created_time: new Date((createdTime || Date.now() / 1000) * 1000).toISOString(),
            meta_form_data: formMap, // Salva o JSON bruto por segurança
            // Nomes amigáveis
            meta_ad_name: adName,
            meta_campaign_name: campaignName,
            meta_adset_name: adsetName
        }).select('id').single();

        if (contactError) throw new Error(`Erro ao inserir contato: ${contactError.message}`);
        contatoIdParaLimpeza = newContact.id;

        // 6. Salva Email e Telefone nas tabelas filhas
        if (emailLead) {
            await supabase.from('emails').insert({ 
                contato_id: newContact.id, 
                email: emailLead, 
                tipo: 'Principal', 
                organizacao_id: organizacaoId 
            });
        }
        
        if (phoneLead) {
            const finalPhone = sanitizePhone(phoneLead);
            if (finalPhone) {
                await supabase.from('telefones').insert({ 
                    contato_id: newContact.id, 
                    telefone: finalPhone, 
                    tipo: 'Celular', 
                    organizacao_id: organizacaoId 
                });
            }
        }
        
        // 7. Coloca no Funil de Vendas
        const colunaId = await ensureFunilAndFirstColumn(supabase, organizacaoId);
        await supabase.from('contatos_no_funil').insert({ 
            contato_id: newContact.id, 
            coluna_id: colunaId, 
            organizacao_id: organizacaoId,
            numero_card: 1 // Ou lógica de autoincremento se tiver
        });
        
        // 8. NOTIFICAÇÕES (Avisa o Ranniere e a Equipe!)
        try {
            const equipe = await getEquipeComercial(supabase, organizacaoId);
            
            if (equipe.length > 0) {
                const promises = equipe.map(user => 
                    enviarNotificacao({
                        userId: user.id,
                        titulo: '🚀 Novo Lead Chegou!',
                        mensagem: `${nomeLead} chegou via ${adName || 'Anúncio Meta'}.`,
                        link: `/crm/funil`, // Link corrigido
                        tipo: 'sucesso',
                        organizacao_id: organizacaoId,
                        canal: 'sistema', // Força notificação no sino
                        supabaseClient: supabase // Passa o admin
                    })
                );
                await Promise.all(promises);
                console.log(`🔔 Notificações enviadas para ${equipe.length} usuários.`);
            }
        } catch (notifErr) { 
            console.error('⚠️ Erro ao enviar notificações (não crítico):', notifErr); 
        }

        return new NextResponse(JSON.stringify({ status: 'success', id: newContact.id }), { status: 200 });

    } catch (e) {
        console.error('❌ LOG: [ERRO CRÍTICO WEBHOOK]', e.message);
        // Rollback simples: se criou o contato mas deu erro no processo, deleta para não ficar "lead zumbi"
        if (contatoIdParaLimpeza) {
            await supabase.from('contatos').delete().eq('id', contatoIdParaLimpeza);
        }
        return new NextResponse(JSON.stringify({ status: 'error', message: e.message }), { status: 500 }); 
    }
}