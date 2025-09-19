// app/api/meta/dados/route.js

import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server'; // Usando o server client

// =================================================================================
// O PORQUÊ DESTE ARQUIVO:
// Este é o nosso "cérebro" para buscar dados da Meta. Em vez de ter uma lógica
// complexa no frontend, centralizamos tudo aqui. Ele recebe um pedido (ex: "me dê
// as campanhas"), busca as informações na Meta, enriquece com dados do nosso banco
// (como a contagem de leads) e devolve tudo pronto para a tela.
// Isso mantém o código organizado, seguro e mais fácil de dar manutenção.
// =================================================================================

const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const API_VERSION = 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// Função auxiliar para fazer chamadas à API da Meta
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
    const supabase = createClient(cookieStore);

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const organizacaoId = session.user.user_metadata.organizacao_id;
        if (!organizacaoId) {
            return NextResponse.json({ error: 'Organização não encontrada para o usuário.' }, { status: 403 });
        }

        // Busca o ID do Gerenciador de Negócios da Meta associado à organização
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

        // Rota para buscar as contas de anúncio
        if (tipo === 'contas') {
            const params = { fields: 'owned_ad_accounts{id,name,account_status}' };
            const data = await metaApiRequest(metaBusinessId, params);
            const accounts = data.owned_ad_accounts?.data.filter(acc => acc.account_status === 1) || [];
            return NextResponse.json(accounts);
        }

        // Rota para buscar as campanhas de uma conta
        if (tipo === 'campanhas') {
            const contaId = searchParams.get('contaId');
            const since = searchParams.get('since');
            const until = searchParams.get('until');

            if (!contaId || !since || !until) {
                return NextResponse.json({ error: 'Parâmetros contaId, since e until são obrigatórios.' }, { status: 400 });
            }

            // 1. Busca as campanhas e suas métricas (insights)
            const params = {
                fields: 'id,name,status,objective,budget_remaining,daily_budget,lifetime_budget,insights.time_range({\'since\':\'' + since + '\',\'until\':\'' + until + '\'}){spend,impressions,clicks,reach}',
                limit: 100, // Aumente se necessário
            };
            const data = await metaApiRequest(`${contaId}/campaigns`, params);
            
            if (!data.data || data.data.length === 0) {
                 return NextResponse.json([]); // Retorna array vazio se não houver campanhas
            }

            const campaigns = data.data;
            const campaignIds = campaigns.map(c => c.id);

            // 2. Conta os leads gerados para cada campanha no nosso banco de dados
            const { data: leadsCount, error: leadsError } = await supabase
                .from('contatos')
                .select('meta_campaign_id', { count: 'exact' })
                .in('meta_campaign_id', campaignIds)
                .eq('organizacao_id', organizacaoId);

            if (leadsError) {
                console.error("LOG: Erro ao contar leads:", leadsError);
                throw new Error("Falha ao buscar contagem de leads.");
            }
            
            // Mapeia a contagem de leads para cada ID de campanha
            const leadsCountMap = (leadsCount || []).reduce((acc, item) => {
                acc[item.meta_campaign_id] = item.count;
                return acc;
            }, {});

            // 3. Combina os dados da Meta com a contagem de leads do nosso sistema
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
                    leads: leadsCountMap[campanha.id] || 0, // Adiciona a contagem de leads
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