// app/api/meta/dados/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; // <-- MUDANÇA CRÍTICA AQUI
import { cookies } from 'next/headers';

// =================================================================================
// O PORQUÊ DESTA ATUALIZAÇÃO FINAL:
// O erro '401 Unauthorized' significa que nossa API no servidor não estava conseguindo
// ler o "cookie" de login do seu navegador.
//
// A CORREÇÃO:
// Trocamos a forma de iniciar o Supabase no servidor. Em vez de usar a biblioteca
// antiga (`@supabase/auth-helpers-nextjs`), agora estamos usando a mais moderna
// e correta (`@supabase/ssr`), que já está no seu projeto.
// A linha `import { createClient } from '@/utils/supabase/server';` garante que
// a API use exatamente o mesmo método de autenticação do resto do seu sistema,
// resolvendo o problema de forma definitiva e segura.
// =================================================================================

const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const API_VERSION = 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

async function metaApiRequest(endpoint, params = {}) {
    if (!PAGE_ACCESS_TOKEN) {
        throw new Error("Token de Acesso à Página (META_PAGE_ACCESS_TOKEN) não configurado no servidor.");
    }
    const urlParams = new URLSearchParams({
        ...params,
        access_token: PAGE_ACCESS_TOKEN,
    });
    const url = `${BASE_URL}/${endpoint}?${urlParams.toString()}`;
    
    console.log(`LOG: [API Meta] Chamando endpoint: ${endpoint}`);
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        console.error(`LOG: [API Meta] Erro na chamada para ${endpoint}:`, data.error);
        throw new Error(data.error?.message || `Erro na API da Meta: ${response.statusText}`);
    }
    return data;
}

export async function GET(request) {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore); // <-- MUDANÇA CRÍTICA AQUI

    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser(); // Usando getUser que é o método recomendado
        if (userError || !user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        
        const userId = user.id;

        const { data: userProfile, error: profileError } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .eq('id', userId)
            .single();

        if (profileError || !userProfile || !userProfile.organizacao_id) {
            console.error(`LOG: Falha ao buscar perfil ou organização para o usuário ID: ${userId}`, profileError);
            return NextResponse.json({ error: 'Organização não encontrada para o usuário.' }, { status: 403 });
        }
        const organizacaoId = userProfile.organizacao_id;
        
        const { data: empresa, error: empresaError } = await supabase
            .from('cadastro_empresa')
            .select('meta_business_id')
            .eq('organizacao_id', organizacaoId)
            .single();

        if (empresaError || !empresa || !empresa.meta_business_id) {
            return NextResponse.json({ error: 'ID do Gerenciador de Negócios da Meta não encontrado para esta organização.' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const tipo = searchParams.get('tipo');
        const metaBusinessId = empresa.meta_business_id;

        if (tipo === 'contas') {
            const params = { fields: 'owned_ad_accounts{id,name,account_status}' };
            const data = await metaApiRequest(metaBusinessId, params);
            const accounts = data.owned_ad_accounts?.data.filter(acc => acc.account_status === 1) || [];
            return NextResponse.json(accounts);
        }

        if (tipo === 'campanhas') {
            const contaId = searchParams.get('contaId');
            const since = searchParams.get('since');
            const until = searchParams.get('until');

            if (!contaId || !since || !until) {
                return NextResponse.json({ error: 'Parâmetros contaId, since e until são obrigatórios.' }, { status: 400 });
            }

            const params = {
                fields: 'id,name,status,objective,budget_remaining,daily_budget,lifetime_budget,insights.time_range({\'since\':\'' + since + '\',\'until\':\'' + until + '\'}){spend,impressions,clicks,reach}',
                limit: 100,
            };
            const data = await metaApiRequest(`${contaId}/campaigns`, params);
            
            if (!data.data || data.data.length === 0) {
                 return NextResponse.json([]);
            }

            const campaigns = data.data;
            const campaignIds = campaigns.map(c => c.id);

             const { data: leadsData, error: leadsError } = await supabase
                .rpc('count_leads_per_campaign', {
                    campaign_ids: campaignIds,
                    p_organizacao_id: organizacaoId
                });

            if (leadsError) {
                console.error("LOG: Erro ao contar leads via RPC:", leadsError);
                throw new Error("Falha ao buscar contagem de leads.");
            }
            
            const leadsCountMap = (leadsData || []).reduce((acc, item) => {
                acc[item.meta_campaign_id] = item.lead_count;
                return acc;
            }, {});

            const campanhasEnriquecidas = campaigns.map(campanha => {
                const insights = campanha.insights?.data[0] || {};
                return {
                    id: campanha.id,
                    nome: campanha.nome,
                    status: campanha.status,
                    objetivo: campanha.objective,
                    orcamento_diario: campanha.daily_budget ? (parseFloat(campanha.daily_budget) / 100).toFixed(2) : null,
                    orcamento_total: campanha.lifetime_budget ? (parseFloat(campanha.lifetime_budget) / 100).toFixed(2) : null,
                    gasto: parseFloat(insights.spend || 0).toFixed(2),
                    impressoes: parseInt(insights.impressions || 0),
                    cliques: parseInt(insights.clicks || 0),
                    alcance: parseInt(insights.reach || 0),
                    leads: leadsCountMap[campanha.id] || 0,
                };
            });
            
            return NextResponse.json(campanhasEnriquecidas);
        }

        return NextResponse.json({ error: 'Tipo de requisição inválido.' }, { status: 400 });

    } catch (error) {
        console.error('LOG: [ERRO GERAL NA API /api/meta/dados]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}