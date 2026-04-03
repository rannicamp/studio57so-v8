// components/empreendimentos/EmpreendimentoDetailWrapper.js
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import EmpreendimentoDetails from './EmpreendimentoDetails';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

const fetchEmpreendimentoData = async (supabase, empreendimentoId, organizacaoId) => {
 if (!empreendimentoId || !organizacaoId) return null;

 // 1. Dados do empreendimento
 const { data: empreendimento, error: empreendimentoError } = await supabase
 .from('empreendimentos')
 .select('*')
 .eq('id', empreendimentoId)
 .eq('organizacao_id', organizacaoId)
 .single();

 if (empreendimentoError) throw new Error(`Erro ao buscar empreendimento: ${empreendimentoError.message}`);

 // 2. Entidades corporativas (via RPC)
 const { data: corporateEntities } = await supabase.rpc('get_corporate_entities', { p_organizacao_id: organizacaoId });

 // 3. Empresas proprietárias
 const { data: proprietariaOptions } = await supabase
 .from('cadastro_empresa')
 .select('id, nome_fantasia, razao_social')
 .eq('organizacao_id', organizacaoId);

 // 4. Produtos
 const { data: produtos } = await supabase
 .from('produtos_empreendimento')
 .select('*')
 .eq('empreendimento_id', empreendimentoId)
 .eq('organizacao_id', organizacaoId);

 // 5. Tipos de documento
 const { data: documentoTipos } = await supabase
 .from('documento_tipos')
 .select('*')
 .order('sigla');

 // 6. Anexos e assinatura de URLs
 const { data: anexosData } = await supabase
 .from('empreendimento_anexos')
 .select(`*, disponivel_corretor, tipo:documento_tipos(*)`)
 .eq('empreendimento_id', empreendimentoId)
 .eq('organizacao_id', organizacaoId);

 let anexosComUrl = [];
 if (anexosData) {
 const signedUrlPromises = anexosData.map(anexo =>
 supabase.storage.from('empreendimento-anexos').createSignedUrl(anexo.caminho_arquivo, 3600)
 );
 const signedUrlResults = await Promise.all(signedUrlPromises);
 anexosComUrl = anexosData.map((anexo, index) => ({
 ...anexo,
 public_url: signedUrlResults[index].data?.signedUrl || null,
 }));
 }

 // 7. Quadro de áreas
 const { data: quadroDeAreas } = await supabase
 .from('quadro_de_areas')
 .select('*')
 .eq('empreendimento_id', empreendimentoId)
 .order('ordem');

 return {
 empreendimento,
 corporateEntities: corporateEntities || [],
 proprietariaOptions: proprietariaOptions || [],
 produtos: produtos || [],
 anexos: anexosComUrl || [],
 documentoTipos: documentoTipos || [],
 quadroDeAreas: quadroDeAreas || []
 };
};

export default function EmpreendimentoDetailWrapper({ empreendimentoId, organizacaoId }) {
 const supabase = createClient();

 const { data, isLoading, isError, error } = useQuery({
 queryKey: ['empreendimentoData', empreendimentoId, organizacaoId],
 queryFn: () => fetchEmpreendimentoData(supabase, empreendimentoId, organizacaoId),
 enabled: !!empreendimentoId && !!organizacaoId,
 staleTime: 1000 * 60 * 5 // Cache por 5 minutos
 });

 if (isLoading) {
 return (
 <div className="h-full flex flex-col items-center justify-center text-gray-500">
 <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-500 mb-4" />
 <p>Carregando dados do Empreendimento...</p>
 </div>
 );
 }

 if (isError) {
 return (
 <div className="p-8">
 <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center gap-3">
 <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl" />
 <p><strong>Erro!</strong> {error.message}</p>
 </div>
 </div>
 );
 }

 if (!data?.empreendimento) {
 return null;
 }

 return (
 <div className="animate-fade-in-up">
 <EmpreendimentoDetails
 empreendimento={data.empreendimento}
 corporateEntities={data.corporateEntities}
 proprietariaOptions={data.proprietariaOptions}
 produtos={data.produtos}
 initialAnexos={data.anexos}
 documentoTipos={data.documentoTipos}
 initialQuadroDeAreas={data.quadroDeAreas}
 organizacaoId={organizacaoId}
 />
 </div>
 );
}
