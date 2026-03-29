// components/empresas/EmpresaAnexosTab.js
"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

import AnexoUploader from '../shared/AnexoUploader';
import GerenciadorAnexosGlobal from '../shared/GerenciadorAnexosGlobal';
import FilePreviewModal from '../shared/FilePreviewModal';

export default function EmpresaAnexosTab({ empresaId, categoria }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const [previewFile, setPreviewFile] = useState(null);

    // Busca Tipos e Anexos juntos
    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['empresaAnexos', empresaId, categoria, organizacaoId],
        queryFn: async () => {
            // 1. Tipos de documento
            const { data: documentoTipos, error: tiposError } = await supabase
                .from('documento_tipos')
                .select('*')
                .order('descricao');
            if (tiposError) throw tiposError;

            // 2. Anexos daquela categoria e daquela empresa
            const { data: anexosData, error: anexosError } = await supabase
                .from('empresa_anexos')
                .select(`*, tipo:documento_tipos (descricao, sigla)`)
                .eq('empresa_id', empresaId)
                .eq('organizacao_id', organizacaoId)
                // Usamos filtro no front para poder reaproveitar o fetch se a categoria mudar? 
                // Melhor já pegar todos ou filtrar aqui
                .eq('categoria_aba', categoria);

            if (anexosError) throw anexosError;

            // 3. Assinar URLs
            const signedUrlPromises = (anexosData || []).map(anexo =>
                supabase.storage.from('empresa-anexos').createSignedUrl(anexo.caminho_arquivo, 3600)
            );
            const signedUrlResults = await Promise.all(signedUrlPromises);

            const anexosComUrl = (anexosData || []).map((anexo, index) => ({
                ...anexo,
                public_url: signedUrlResults[index].data?.signedUrl || null,
            }));

            return { documentoTipos, anexos: anexosComUrl };
        },
        enabled: !!empresaId && !!organizacaoId
    });

    const handleUploadSuccess = async (newAnexoData) => {
        // Quando o upload termina, nós simplesmente refazemos a busca
        refetch();
    };

    const handleDeleteAnexo = async (anexoToDelete) => {
        if (!anexoToDelete || !window.confirm(`Tem certeza que deseja excluir "${anexoToDelete.nome_arquivo}"?`)) return;

        toast.promise(
            new Promise(async (resolve, reject) => {
                const { error: storageError } = await supabase.storage.from('empresa-anexos').remove([anexoToDelete.caminho_arquivo]);
                if (storageError && storageError.statusCode !== '404') return reject(storageError);

                const { error: dbError } = await supabase.from('empresa_anexos').delete().eq('id', anexoToDelete.id);
                if (dbError) return reject(dbError);

                resolve("Anexo excluído com sucesso!");
            }),
            {
                loading: 'Excluindo...',
                success: (msg) => {
                    refetch();
                    return msg;
                },
                error: (err) => `Erro ao excluir: ${err.message}`,
            }
        );
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12 text-gray-400">
                <FontAwesomeIcon icon={faSpinner} spin className="text-3xl" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200 flex gap-3 items-center">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl" />
                <p>Erro ao carregar anexos: {error.message}</p>
            </div>
        );
    }

    const { documentoTipos, anexos } = data || { documentoTipos: [], anexos: [] };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Modal de Pre-visualização */}
            <FilePreviewModal 
                anexo={previewFile}
                onClose={() => setPreviewFile(null)}
            />

            <AnexoUploader
                parentId={empresaId}
                storageBucket="empresa-anexos"
                tableName="empresa_anexos"
                allowedTipos={documentoTipos}
                onUploadSuccess={handleUploadSuccess}
                categoria={categoria}
                organizacaoId={organizacaoId}
            />

            <GerenciadorAnexosGlobal 
                anexos={anexos} 
                viewMode={categoria === 'marketing' ? 'grid' : 'list'}
                storageBucket="empresa-anexos"
                onDelete={handleDeleteAnexo}
                onPreview={setPreviewFile}
            />
        </div>
    );
}
