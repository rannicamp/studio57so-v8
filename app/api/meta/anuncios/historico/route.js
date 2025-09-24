// app/api/meta/anuncios/historico/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

// O PORQUÊ DESTE NOVO ARQUIVO:
// Esta é a nossa "ponte" para a análise avançada. Sua única tarefa é
// receber um pedido do front-end com um período de datas e repassar
// esse pedido para a nossa função inteligente no banco de dados, a
// 'get_performance_por_periodo'. Ele então pega o resultado
// calculado e o entrega de volta para a página.

export async function POST(request) {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    try {
        // Segurança: Verificando o usuário e sua organização
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
            return NextResponse.json({ error: 'Perfil do usuário não encontrado.' }, { status: 403 });
        }
        
        // Pega as datas enviadas pelo front-end
        const { startDate, endDate } = await request.json();
        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Data de início e fim são obrigatórias.' }, { status: 400 });
        }

        // Chama nossa função RPC (Remote Procedure Call) no Supabase
        const { data: performanceData, error } = await supabase.rpc('get_performance_por_periodo', {
            p_organizacao_id: profile.organizacao_id,
            p_start_date: startDate,
            p_end_date: endDate
        });

        if (error) {
            console.error("Erro ao chamar a função get_performance_por_periodo:", error);
            throw new Error("Falha ao calcular a performance dos anúncios.");
        }

        // Retorna os dados calculados
        return NextResponse.json(performanceData);

    } catch (error) {
        console.error('Erro na API de histórico de anúncios:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}