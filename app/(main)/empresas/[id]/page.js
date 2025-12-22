// app/(main)/empresas/[id]/page.js
'use client';

import { createClient } from '../../../../utils/supabase/client';
import { useParams, notFound } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import EmpresaDetails from '../../../../components/empresas/EmpresaDetails';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// Função que busca TODOS os dados necessários para a página
const fetchEmpresaData = async (supabase, empresaId, organizacaoId) => {
    if (!empresaId || !organizacaoId) return null;

    // 1. Busca a empresa (sem alterações aqui)
    const { data: empresa, error: empresaError } = await supabase
        .from('cadastro_empresa')
        .select('*')
        .eq('id', empresaId)
        .eq('organizacao_id', organizacaoId)
        .single();

    if (empresaError) {
        if (empresaError.code === 'PGRST116') {
            throw new Error('Empresa não encontrada ou você não tem permissão.');
        }
        throw new Error(`Erro ao buscar empresa: ${empresaError.message}`);
    }

    // =================================================================================
    // CORREÇÃO APLICADA AQUI
    // O PORQUÊ: Alteramos o nome da tabela de 'tipos_documento' para 'documento_tipos'
    // e adicionamos o filtro de 'organizacao_id' para buscar apenas os tipos
    // de documento que pertencem à sua organização, conforme a estrutura correta.
    // =================================================================================
    const { data: documentoTipos, error: tiposError } = await supabase
        .from('documento_tipos')
        .select('*')
        .eq('organizacao_id', organizacaoId) // Adicionado filtro de segurança
        .order('descricao');
    
    if (tiposError) throw new Error(`Erro ao buscar tipos de documento: ${tiposError.message}`);

    // 3. Busca os anexos (sem alterações aqui)
    const { data: anexosData, error: anexosError } = await supabase
        .from('empresa_anexos')
        .select(`*, tipo:documento_tipos (descricao, sigla)`) // Corrigido o nome da relação
        .eq('empresa_id', empresaId)
        .eq('organizacao_id', organizacaoId);

    if (anexosError) throw new Error(`Erro ao buscar anexos: ${anexosError.message}`);

    // 4. Gera as URLs públicas para os anexos (sem alterações aqui)
    const signedUrlPromises = (anexosData || []).map(anexo =>
        supabase.storage.from('empresa-anexos').createSignedUrl(anexo.caminho_arquivo, 3600)
    );
    const signedUrlResults = await Promise.all(signedUrlPromises);
    const anexosComUrl = (anexosData || []).map((anexo, index) => ({
        ...anexo,
        public_url: signedUrlResults[index].data?.signedUrl || null,
    }));

    return { empresa, documentoTipos, anexos: anexosComUrl };
};

export default function EmpresaPage() {
    const supabase = await createClient();
    const params = useParams();
    const { id: empresaId } = params;
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['empresaData', empresaId, organizacaoId],
        queryFn: () => fetchEmpresaData(supabase, empresaId, organizacaoId),
        enabled: !!empresaId && !!organizacaoId,
        retry: false,
    });

    if (isLoading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    }

    if (isError && error.message.includes('Empresa não encontrada')) {
        notFound();
    }
    
    if (isError) {
        return <div className="p-4 text-red-500 text-center">Erro ao carregar os dados: {error.message}</div>;
    }
    
    if (!data?.empresa) {
        return <div className="text-center p-10">Dados não encontrados.</div>;
    }

    return (
        <EmpresaDetails
            empresa={data.empresa}
            initialAnexos={data.anexos || []}
            documentoTipos={data.documentoTipos || []}
            organizacaoId={organizacaoId}
        />
    );
}