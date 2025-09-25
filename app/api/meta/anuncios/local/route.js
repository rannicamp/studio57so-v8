// app/api/meta/anuncios/local/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request) {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .eq('id', user.id)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'Perfil do usuário não encontrado.' }, { status: 404 });
        }
        const organizacaoId = profile.organizacao_id;

        const { filters, page = 1, limit = 20 } = await request.json();
        // O ideal é que o front-end envie os nomes, não os IDs, pois a tabela de histórico não possui os IDs de campanha/adset.
        const { searchTerm, campaignNames, adsetNames } = filters;

        // Passo 1: Construir a query na nossa nova VIEW, que é muito mais performática.
        let query = supabase
            .from('latest_ad_snapshots') // Usando a VIEW que criamos!
            .select('*', { count: 'exact' }) // 'exact' conta o total de itens, respeitando os filtros.
            .eq('organizacao_id', organizacaoId);

        // Passo 2: Aplicar filtros DIRETAMENTE no banco de dados.
        if (searchTerm) {
            // Busca o termo no nome do anúncio, campanha ou conjunto.
            query = query.or(`ad_name.ilike.%${searchTerm}%,campaign_name.ilike.%${searchTerm}%,adset_name.ilike.%${searchTerm}%`);
        }
        
        // Assumindo que o filtro agora pode enviar um array de nomes de campanhas
        if (campaignNames && campaignNames.length > 0) {
            query = query.in('campaign_name', campaignNames);
        }
        
        // Assumindo que o filtro agora pode enviar um array de nomes de conjuntos de anúncios
        if (adsetNames && adsetNames.length > 0) {
            query = query.in('adset_name', adsetNames);
        }

        // Passo 3: Aplicar paginação DIRETAMENTE no banco de dados.
        const from = (page - 1) * limit;
        const to = from + limit - 1; // O .range é inclusivo
        query = query.range(from, to);

        // Executar a query otimizada
        const { data: adSnapshots, error, count } = await query;

        if (error) {
            console.error("Erro ao buscar snapshots de anúncios:", error);
            throw error;
        }
        
        // Passo 4: Formatar os dados para a tela.
        const formattedAds = adSnapshots.map(ad => {
            const spend = ad.spend || 0;
            const leads = ad.leads || 0;
            const impressions = ad.impressions || 0;
            const reach = ad.reach || 0;

            return {
                id: ad.ad_id,
                name: ad.ad_name,
                campaign_name: ad.campaign_name,
                adset_name: ad.adset_name,
                // Os campos 'status' e 'thumbnail_url' foram removidos pois não estão na tabela de histórico.
                // Isso simplifica enormemente a query e evita a complexidade original.
                spend: spend,
                reach: reach,
                impressions: impressions,
                leads: leads,
                cost_per_lead: leads > 0 ? (spend / leads) : 0,
                frequencia: reach > 0 ? (impressions / reach) : 0,
            };
        });

        return NextResponse.json({
            ads: formattedAds,
            total: count // O total agora vem diretamente da query!
        });

    } catch (error) {
        console.error('Erro geral na API de busca de anúncios locais:', error.message);
        return NextResponse.json({ error: 'Falha ao buscar anúncios: ' + error.message }, { status: 500 });
    }
}