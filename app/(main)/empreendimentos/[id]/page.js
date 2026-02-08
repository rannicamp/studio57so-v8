// app/(main)/empreendimentos/[id]/page.js

import { createClient } from '@/utils/supabase/server';
import EmpreendimentoDetails from '@/components/empreendimentos/EmpreendimentoDetails';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ViewEmpreendimentoPage({ params }) {
    const { id } = params;
    const supabase = await createClient();

    // =================================================================================
    // CORREÇÃO DE SEGURANÇA (organizacao_id)
    // O PORQUÊ: O primeiro passo é sempre identificar o usuário e sua organização.
    // Sem isso, não podemos garantir a segurança dos dados.
    // =================================================================================
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }
    const { data: userProfile } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
    const organizacaoId = userProfile?.organizacao_id;

    if (!organizacaoId) {
        // Se não houver organização, não há como buscar dados de forma segura.
        return <p className="p-4 text-red-500">Erro: Organização do usuário não encontrada.</p>;
    }

    // 1. Buscar dados do empreendimento, AGORA COM FILTRO DE SEGURANÇA
    const { data: empreendimento, error: empreendimentoError } = await supabase
        .from('empreendimentos')
        .select('*')
        .eq('id', id)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA CRÍTICO!
        .single();

    if (empreendimentoError || !empreendimento) {
        notFound();
    }

    // 2. Buscar entidades corporativas, AGORA PASSANDO O FILTRO DE SEGURANÇA
    // ATENÇÃO: A função 'get_corporate_entities' no banco PRECISA ser alterada para usar este parâmetro.
    const { data: corporateEntities } = await supabase.rpc('get_corporate_entities', { p_organizacao_id: organizacaoId });

    // 3. Buscar empresas, AGORA COM FILTRO DE SEGURANÇA
    const { data: proprietariaOptions } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacaoId);

    // 4. Buscar produtos do empreendimento, AGORA COM FILTRO DE SEGURANÇA
    const { data: produtos } = await supabase.from('produtos_empreendimento').select('*').eq('empreendimento_id', id).eq('organizacao_id', organizacaoId);

    // 5. Buscar tipos de documento, AGORA COM FILTRO DE SEGURANÇA
    const { data: documentoTipos } = await supabase.from('documento_tipos').select('*').eq('organizacao_id', organizacaoId).order('sigla');

    // ======================= A CORREÇÃO ESTÁ AQUI =======================
    // 6. Buscar anexos, AGORA COM FILTRO DE SEGURANÇA E A NOVA COLUNA
    const { data: anexosData } = await supabase
        .from('empreendimento_anexos')
        .select(`*, disponivel_corretor, tipo:documento_tipos(*)`) // <-- ADICIONADO "disponivel_corretor"
        .eq('empreendimento_id', empreendimento.id)
        .eq('organizacao_id', organizacaoId);
    // ======================= FIM DA CORREÇÃO =======================
    
    // A geração de URLs assinadas não precisa de alteração, pois já depende dos anexos filtrados
    const anexosComUrl = await Promise.all(
        (anexosData || []).map(async anexo => {
            const { data } = await supabase.storage.from('empreendimento-anexos').createSignedUrl(anexo.caminho_arquivo, 3600);
            return { ...anexo, public_url: data?.signedUrl };
        })
    );

    // 7. Buscar quadro de áreas (este é o único que não podemos filtrar diretamente ainda)
    const { data: quadroDeAreas } = await supabase.from('quadro_de_areas').select('*').eq('empreendimento_id', empreendimento.id).order('ordem');

    return (
        <EmpreendimentoDetails
            empreendimento={empreendimento}
            corporateEntities={corporateEntities || []}
            proprietariaOptions={proprietariaOptions || []}
            produtos={produtos || []}
            initialAnexos={anexosComUrl || []}
            documentoTipos={documentoTipos || []}
            initialQuadroDeAreas={quadroDeAreas || []}
            organizacaoId={organizacaoId} // <-- AQUI ESTÁ A MÁGICA! Entregando o ID para o componente.
        />
    );
}