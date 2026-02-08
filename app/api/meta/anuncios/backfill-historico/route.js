// app/api/meta/anuncios/backfill-historico/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

// O PORQUÊ DESTE ARQUIVO:
// Este é o nosso "robô de importação". Sua única função é buscar o histórico
// de performance diária de todos os anúncios diretamente da Meta e preencher
// nossa tabela `meta_ads_historico`. Ele garante que nossa base de dados
// tenha informações desde o início de cada campanha, não apenas a partir
// de quando começamos a sincronizar.

const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const API_VERSION = 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

export async function GET(request) {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    console.log("LOG: Iniciando processo de backfill do histórico de anúncios.");

    if (!PAGE_ACCESS_TOKEN) {
        return NextResponse.json({ error: 'Token de acesso da Meta não configurado.' }, { status: 500 });
    }

    try {
        // 1. Segurança: Validar o usuário e obter a organização
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        const { data: profile } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
        if (!profile) {
            return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 403 });
        }
        const organizacaoId = profile.organizacao_id;

        // 2. Buscar todos os anúncios da organização no nosso banco
        const { data: adsToProcess, error: adsError } = await supabase
            .from('meta_ads')
            .select('id, created_time')
            .eq('organizacao_id', organizacaoId);

        if (adsError) throw adsError;
        if (!adsToProcess || adsToProcess.length === 0) {
            return NextResponse.json({ message: 'Nenhum anúncio encontrado para processar.' });
        }

        console.log(`LOG: Encontrados ${adsToProcess.length} anúncios para buscar o histórico.`);
        
        let totalRecordsSaved = 0;

        // 3. Para cada anúncio, buscar o histórico diário na Meta
        for (const ad of adsToProcess) {
            const startDate = ad.created_time.split('T')[0];
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const endDate = yesterday.toISOString().split('T')[0];

            // Se a data de criação for depois de ontem, não há histórico para buscar
            if (new Date(startDate) > new Date(endDate)) {
                console.log(`LOG: Anúncio ${ad.id} é muito recente, pulando.`);
                continue;
            }

            const url = `${BASE_URL}/${ad.id}/insights?time_range={'since':'${startDate}','until':'${endDate}'}&time_increment=1&level=ad&fields=spend,impressions,clicks,reach,actions&limit=1000&access_token=${PAGE_ACCESS_TOKEN}`;

            const metaResponse = await fetch(url);
            const metaData = await metaResponse.json();

            if (!metaResponse.ok) {
                console.warn(`AVISO: Falha ao buscar histórico para o anúncio ${ad.id}. Erro: ${metaData.error?.message}`);
                continue; // Pula para o próximo anúncio em caso de erro
            }

            const dailyData = metaData.data || [];
            if (dailyData.length === 0) {
                continue; // Pula se não houver dados no período
            }

            // 4. Formatar os dados para o nosso banco
            const historicoToInsert = dailyData.map(insight => {
                const leadAction = insight.actions?.find(a => ['lead', 'onsite_conversion.lead', 'form_lead'].includes(a.action_type));
                return {
                    ad_id: ad.id,
                    data_snapshot: insight.date_start,
                    spend: parseFloat(insight.spend || 0),
                    impressions: parseInt(insight.impressions || 0),
                    clicks: parseInt(insight.clicks || 0),
                    reach: parseInt(insight.reach || 0),
                    leads: leadAction ? parseInt(leadAction.value, 10) : 0,
                    organizacao_id: organizacaoId,
                };
            });
            
            if (historicoToInsert.length > 0) {
                 // 5. Limpar dados antigos para evitar duplicatas e inserir os novos
                const firstDate = historicoToInsert[0].data_snapshot;
                const lastDate = historicoToInsert[historicoToInsert.length - 1].data_snapshot;

                console.log(`LOG: Para o anúncio ${ad.id}, limpando dados entre ${firstDate} e ${lastDate}.`);
                await supabase.from('meta_ads_historico')
                    .delete()
                    .eq('ad_id', ad.id)
                    .gte('data_snapshot', firstDate)
                    .lte('data_snapshot', lastDate);
                
                console.log(`LOG: Inserindo ${historicoToInsert.length} registros para o anúncio ${ad.id}.`);
                const { error: insertError } = await supabase.from('meta_ads_historico').insert(historicoToInsert);

                if (insertError) {
                    console.error(`ERRO: Falha ao inserir dados para o anúncio ${ad.id}. Erro: ${insertError.message}`);
                } else {
                    totalRecordsSaved += historicoToInsert.length;
                }
            }
        }

        console.log("LOG: Processo de backfill concluído.");
        return NextResponse.json({
            message: `Processo de backfill concluído com sucesso!`,
            totalAnunciosProcessados: adsToProcess.length,
            totalRegistrosHistoricosSalvos: totalRecordsSaved
        });

    } catch (error) {
        console.error('ERRO GERAL no processo de backfill:', error.message);
        return NextResponse.json({ error: 'Ocorreu um erro inesperado durante o backfill.', details: error.message }, { status: 500 });
    }
}