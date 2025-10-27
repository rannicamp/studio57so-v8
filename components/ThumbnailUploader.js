"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faSpinner, faTrash, faBuilding, faCheck } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner'; // <-- Usando o 'sonner'
import imageCompression from 'browser-image-compression';

// O PORQUÊ: Este componente gerencia o upload da imagem de capa.
export default function ThumbnailUploader({ empreendimentoId, organizacaoId, initialImageUrl }) {
    const supabase = createClient();
    const queryClient = useQueryClient();

    const [previewUrl, setPreviewUrl] = useState(initialImageUrl || null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        setPreviewUrl(initialImageUrl || null);
    }, [initialImageUrl]);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const options = {
            maxSizeMB: 1, 
            maxWidthOrHeight: 1024, 
            useWebWorker: true,
        };

        const toastId = toast.loading('Comprimindo imagem...'); // <-- Inicia um toast de 'loading'
        try {
            setUploading(true); 
            const compressedFile = await imageCompression(file, options);
            
            setSelectedFile(compressedFile);
            setPreviewUrl(URL.createObjectURL(compressedFile));
            setUploading(false);
            toast.dismiss(toastId); // <-- Fecha o toast de 'loading'

        } catch (error) {
            console.error('Erro ao comprimir imagem:', error);
            toast.error('Erro ao processar imagem.', { id: toastId }); 
            setUploading(false);
        }
    };

    const uploadMutation = useMutation({
        mutationFn: async () => {
            if (!selectedFile) throw new Error("Nenhum arquivo selecionado.");
            setUploading(true);
            
            const fileName = `${empreendimentoId}-${Date.now()}-${selectedFile.name}`;
            const filePath = `public/${organizacaoId}/${fileName}`;

            // 1. Enviar para o Storage
            const { error: storageError } = await supabase.storage
                .from('empreendimento-capas') // <-- Nome do seu Bucket
                .upload(filePath, selectedFile);

            if (storageError) throw storageError;

            // 2. Pegar a URL pública
            const { data: urlData } = supabase.storage
                .from('empreendimento-capas') // <-- Nome do seu Bucket
                .getPublicUrl(filePath);

            const publicUrl = urlData.publicUrl;

            // 3. Salvar a URL no banco
            const { error: dbError } = await supabase
                .from('empreendimentos')
                .update({ imagem_capa_url: publicUrl }) // <-- Coluna do seu Banco
                .eq('id', empreendimentoId);

            if (dbError) throw dbError;
            return publicUrl;
        },
        onSuccess: (publicUrl) => {
            toast.success("Imagem de capa atualizada!");
            setPreviewUrl(publicUrl); 
            setSelectedFile(null); 
            // O PORQUÊ: Invalidamos as duas queries para atualizar
            // tanto a lista de cards quanto a página de detalhes atual.
            queryClient.invalidateQueries({ queryKey: ['empreendimentos', organizacaoId] });
            queryClient.invalidateQueries({ queryKey: ['empreendimento', empreendimentoId] });
        },
        onError: (error) => {
            console.error("Erro no upload:", error);
            toast.error(`Erro ao salvar imagem: ${error.message}`);
        },
        onSettled: () => {
            setUploading(false);
        }
    });

    const removeMutation = useMutation({
        mutationFn: async () => {
            setUploading(true);
            
            const { error: dbError } = await supabase
                .from('empreendimentos')
                .update({ imagem_capa_url: null })
                .eq('id', empreendimentoId);

            if (dbError) throw dbError;
        },
        onSuccess: () => {
            toast.success("Imagem de capa removida!");
            setPreviewUrl(null);
            setSelectedFile(null);
            queryClient.invalidateQueries({ queryKey: ['empreendimentos', organizacaoId] });
            queryClient.invalidateQueries({ queryKey: ['empreendimento', empreendimentoId] });
        },
        onError: (error) => {
            console.error("Erro ao remover:", error);
            toast.error(`Erro ao remover imagem: ${error.message}`);
        },
        onSettled: () => {
            setUploading(false);
        }
    });

    return (
        <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700">Imagem de Capa (Thumbnail)</label>
            
            <div className="w-full h-48 relative bg-gray-200 rounded-md flex items-center justify-center overflow-hidden">
                {previewUrl ? (
                    <Image
                        src={previewUrl}
                        alt="Preview da capa"
                        layout="fill"
                        objectFit="cover"
                        key={previewUrl}
                    />
                ) : (
                    <FontAwesomeIcon icon={faBuilding} className="text-gray-400" size="3x" />
                )}
            </div>

            <input
                id="thumbnail-upload"
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
            />

            <div className="flex gap-3">
                <label 
                    htmlFor="thumbnail-upload"
                    className={`cursor-pointer w-full flex-1 text-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <FontAwesomeIcon icon={faUpload} className="mr-2" />
                    Escolher Imagem
                </label>

                {previewUrl && !selectedFile && (
                    <button
                        type="button"
                        onClick={() => removeMutation.mutate()}
                        disabled={uploading || removeMutation.isPending}
                        className="flex-1 text-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    >
                        {uploading && !uploadMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faTrash} className="mr-2" />}
                        Remover
                    </button>
                )}
            </div>

            {selectedFile && (
                <button
                    type="button"
                    onClick={() => uploadMutation.mutate()}
                    disabled={uploading || uploadMutation.isPending}
                    className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                    {uploading && uploadMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> : <FontAwesomeIcon icon={faCheck} className="mr-2" />}
                    Salvar Nova Imagem
                </button>
            )}
        </div>
    );
}