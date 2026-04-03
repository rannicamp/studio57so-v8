// components/empresas/EmpresaDetailWrapper.js
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import EmpresaDetails from './EmpresaDetails';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

const fetchEmpresaData = async (supabase, empresaId, organizacaoId) => {
 if (!empresaId || !organizacaoId) return null;

 // 1. Busca a empresa
 const { data: empresa, error: empresaError } = await supabase
 .from('cadastro_empresa')
 .select('*')
 .eq('id', empresaId)
 .eq('organizacao_id', organizacaoId)
 .single();

 if (empresaError) {
 throw new Error(`Erro ao buscar empresa: ${empresaError.message}`);
 }

 // 2. Busca Tipos de Documento
 const { data: documentoTipos, error: tiposError } = await supabase
 .from('documento_tipos')
 .select('*')
 .order('descricao');

 if (tiposError) throw new Error(`Erro ao buscar tipos: ${tiposError.message}`);

 // 3. Busca Anexos
 const { data: anexosData, error: anexosError } = await supabase
 .from('empresa_anexos')
 .select(`*, tipo:documento_tipos (descricao, sigla)`)
 .eq('empresa_id', empresaId)
 .eq('organizacao_id', organizacaoId);

 if (anexosError) throw new Error(`Erro ao buscar anexos: ${anexosError.message}`);

 // 4. Assina URLs
 let anexosComUrl = [];
 if (anexosData) {
 const signedUrlPromises = anexosData.map(anexo =>
 supabase.storage.from('empresa-anexos').createSignedUrl(anexo.caminho_arquivo, 3600)
 );
 const signedUrlResults = await Promise.all(signedUrlPromises);
 anexosComUrl = anexosData.map((anexo, index) => ({
 ...anexo,
 public_url: signedUrlResults[index].data?.signedUrl || null,
 }));
 }

 return { empresa, documentoTipos: documentoTipos || [], anexos: anexosComUrl || [] };
};

export default function EmpresaDetailWrapper({ empresaId, organizacaoId }) {
 const supabase = createClient();

 const { data, isLoading, isError, error } = useQuery({
 queryKey: ['empresaData', empresaId, organizacaoId],
 queryFn: () => fetchEmpresaData(supabase, empresaId, organizacaoId),
 enabled: !!empresaId && !!organizacaoId,
 staleTime: 1000 * 60 * 5 // Cache por 5 minutos
 });

 if (isLoading) {
 return (
 <div className="h-full flex flex-col items-center justify-center text-gray-500">
 <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-500 mb-4" />
 <p>Carregando dados da Empresa...</p>
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

 if (!data?.empresa) {
 return null;
 }

 return (
 <div className="animate-fade-in-up">
 <EmpresaDetails
 empresa={data.empresa}
 initialAnexos={data.anexos}
 documentoTipos={data.documentoTipos}
 organizacaoId={organizacaoId}
 />
 </div>
 );
}
