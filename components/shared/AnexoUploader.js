"use client";

import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import UppyListUploader from '@/components/ui/UppyListUploader';

export default function AnexoUploader({ parentId, storageBucket, tableName, allowedTipos, onUploadSuccess, categoria, organizacaoId }) {
    const supabase = createClient();

    const handleUppySuccess = async (result) => {
        const tipoId = result.tipoDocumento;
        if (!tipoId) return;

        const tipoSelecionado = allowedTipos.find(t => t.id == tipoId);
        const sigla = tipoSelecionado?.sigla || 'DOC';

        // O Uppy já fez o upload real para o Storage (result.path)
        // Agora fazemos a inserção na tabela final do banco
        const { data: dbData, error: dbError } = await supabase.from(tableName).insert({
            [tableName === 'empresa_anexos' ? 'empresa_id' : 'empreendimento_id']: parentId,
            caminho_arquivo: result.path,
            nome_arquivo: result.fileName,
            descricao: result.descricao || '',
            tipo_documento_id: tipoId,
            categoria_aba: categoria,
            organizacao_id: organizacaoId
        }).select().single();

        if (dbError) {
            toast.error(`Erro ao salvar no banco o arquivo ${result.fileName}: ${dbError.message}`);
        } else {
            toast.success(`Arquivo ${result.fileName} anexado e salvo com sucesso!`);
            if (onUploadSuccess) {
                onUploadSuccess(dbData);
            }
        }
    };

    return (
        <div className="p-4 bg-white border rounded-lg space-y-4 shadow-sm w-full">
            <h4 className="font-semibold text-gray-700">Adicionar Novo Documento</h4>
            <div className="border border-blue-100 rounded-xl overflow-hidden shadow-sm max-h-[500px]">
                <UppyListUploader
                    bucketName={storageBucket}
                    folderPath={`${parentId}/anexos`}
                    tiposDocumento={allowedTipos}
                    onUploadSuccess={handleUppySuccess}
                />
            </div>
        </div>
    );
}