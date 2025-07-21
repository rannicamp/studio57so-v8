import { createClient } from '@/utils/supabase/server';
import EmpreendimentoDetails from '@/components/EmpreendimentoDetails';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ViewEmpreendimentoPage({ params }) {
  const { id } = params;
  const supabase = createClient();

  // 1. Buscar dados do empreendimento
  const { data: empreendimento, error: empreendimentoError } = await supabase
    .from('empreendimentos')
    .select('*')
    .eq('id', id)
    .single();

  if (empreendimentoError || !empreendimento) {
    notFound();
  }

  // 2. Buscar entidades corporativas (para Incorporadora/Construtora)
  const { data: corporateEntities } = await supabase.rpc('get_corporate_entities');

  // 3. Buscar empresas (para Empresa Proprietária)
  const { data: proprietariaOptions } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social');

  // 4. Buscar produtos do empreendimento
  const { data: produtos } = await supabase.from('produtos_empreendimento').select('*').eq('empreendimento_id', id);

  // 5. Buscar TODOS os tipos de documento para o formulário de upload
  const { data: documentoTipos } = await supabase.from('documento_tipos').select('*').order('sigla');

  // 6. Buscar anexos e gerar URLs assinadas no servidor
  const { data: anexosData } = await supabase.from('empreendimento_anexos').select(`*, tipo:documento_tipos(*)`).eq('empreendimento_id', empreendimento.id);
  const anexosComUrl = await Promise.all(
    (anexosData || []).map(async anexo => {
      const { data } = await supabase.storage.from('empreendimento-anexos').createSignedUrl(anexo.caminho_arquivo, 3600);
      return { ...anexo, public_url: data?.signedUrl };
    })
  );

  // 7. Buscar quadro de áreas
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
    />
  );
}