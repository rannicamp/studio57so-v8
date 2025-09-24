// app/api/meta/anuncios/local/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

// O PORQUÊ DA MUDANÇA:
// A versão anterior tentava ordenar por 'created_time', uma coluna que não existia.
// Agora que criamos a coluna no Passo 1, este código vai funcionar perfeitamente.
// Ele ordena os anúncios pela data de criação, mostrando os mais recentes primeiro,
// e também ativa os filtros de data que estavam comentados.

export async function POST(request) {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'Perfil do usuário não encontrado.' }, { status: 403 });
        }
        const organizacaoId = profile.organizacao_id;

        const { filters, page = 1, limit = 20 } = await request.json();
        const { searchTerm, status, campaignIds, adsetIds, startDate, endDate } = filters;

        let query = supabase
            .from('meta_ads')
            .select(`
                *,
                campaign:meta_campaigns(name),
                adset:meta_adsets(name)
            `, { count: 'exact' })
            .eq('organizacao_id', organizacaoId);

        if (searchTerm) {
            query = query.ilike('name', `%${searchTerm}%`);
        }
        if (status && status.length > 0) {
            query = query.in('status', status);
        }
        if (campaignIds && campaignIds.length > 0) {
            query = query.in('campaign_id', campaignIds);
        }
        if (adsetIds && adsetIds.length > 0) {
            query = query.in('adset_id', adsetIds);
        }
        // Filtros de data agora estão ATIVOS e funcionando com a nova coluna
        if (startDate) {
            query = query.gte('created_time', startDate);
        }
        if (endDate) {
            query = query.lte('created_time', endDate);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        // A ordenação agora vai funcionar corretamente
        query = query.order('created_time', { ascending: false, nullsFirst: false }).range(from, to);

        const { data, error, count } = await query;

        if (error) {
            console.error("Erro ao buscar anúncios locais no Supabase:", error);
            throw error;
        }

        const formattedAds = data.map(ad => ({
            ...ad,
            campaign_name: ad.campaign?.name || 'N/A',
            adset_name: ad.adset?.name || 'N/A',
            spend: ad.insights?.spend || 0,
            reach: ad.insights?.reach || 0,
            impressions: ad.insights?.impressions || 0,
            leads: ad.insights?.leads || 0,
            cost_per_lead: ad.insights?.cost_per_lead || 0,
            frequencia: (ad.insights?.impressions && ad.insights?.reach) ? (ad.insights.impressions / ad.insights.reach) : 0,
        }));

        return NextResponse.json({
            ads: formattedAds,
            total: count
        });

    } catch (error) {
        console.error('Erro geral na API de busca de anúncios locais:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}