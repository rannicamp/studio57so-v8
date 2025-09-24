// app/api/meta/anuncios/filter-options/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

// O PORQUÊ DESTE NOVO ARQUIVO:
// Ele tem a simples e nobre tarefa de buscar e retornar uma lista única de todas as
// campanhas e conjuntos de anúncios salvos em nosso banco de dados para uma
// determinada organização. Isso permite que os filtros na página de anúncios
// sejam populados instantaneamente, sem depender da busca principal de anúncios,
// resolvendo o problema dos "filtros cegos".

export async function GET() {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    try {
        // Passo 1: Segurança em primeiro lugar. Verificamos quem está pedindo.
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Passo 2: Descobrimos a qual organização o usuário pertence.
        const { data: profile } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .eq('id', user.id)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'Perfil do usuário não encontrado.' }, { status: 403 });
        }
        const organizacaoId = profile.organizacao_id;

        // Passo 3: Buscamos, de uma só vez, todas as campanhas e conjuntos da organização.
        const campaignsPromise = supabase
            .from('meta_campaigns')
            .select('id, name')
            .eq('organizacao_id', organizacaoId);

        const adsetsPromise = supabase
            .from('meta_adsets')
            .select('id, name')
            .eq('organizacao_id', organizacaoId);

        // Promise.all é nosso truque de mágica para fazer as duas buscas ao mesmo tempo.
        const [{ data: campaigns, error: campaignsError }, { data: adsets, error: adsetsError }] = await Promise.all([campaignsPromise, adsetsPromise]);

        if (campaignsError || adsetsError) {
            console.error({ campaignsError, adsetsError });
            throw new Error('Falha ao buscar opções de filtro no banco de dados.');
        }

        // Passo 4: Formatamos os dados para o formato que nosso componente de filtro espera.
        // O componente MultiSelectDropdown espera um campo 'nome'.
        const formattedCampaigns = campaigns.map(c => ({ id: c.id, nome: c.name }));
        const formattedAdsets = adsets.map(a => ({ id: a.id, nome: a.name }));

        // Passo 5: Entregamos a lista pronta para uso!
        return NextResponse.json({
            campaigns: formattedCampaigns || [],
            adsets: formattedAdsets || [],
        });

    } catch (error) {
        console.error('Erro na API de busca de opções de filtro:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}