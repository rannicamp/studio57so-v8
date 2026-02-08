// components/ThumbnailUploader.js
"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faTrash, faSpinner, faImage } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function ThumbnailUploader({ 
    url, 
    onUpload, 
    bucketName = 'empreendimentos', 
    label = "Imagem de Capa (Thumbnail)",
    aspectRatio = "aspect-video", // 'aspect-video' (retangular) ou 'aspect-square' (quadrado/logo)
    objectFit = "object-cover"    // 'object-cover' (preenche) ou 'object-contain' (ajusta sem cortar)
}) {
    const supabase = createClient();
    const [uploading, setUploading] = useState(false);

    const uploadImage = async (event) => {
        try {
            setUploading(true);
            const file = event.target.files[0];
            if (!file) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            let { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            // Pega a URL pública
            const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
            
            // Passa a URL para o formulário pai
            onUpload(data.publicUrl);
            toast.success('Imagem enviada com sucesso!');
        } catch (error) {
            console.error('Erro no upload:', error);
            toast.error('Erro ao fazer upload da imagem.');
        } finally {
            setUploading(false);
        }
    };

    const removeImage = () => {
        onUpload(null);
        toast.info('Imagem removida.');
    };

    return (
        <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            
            {url ? (
                <div className="relative group">
                    {/* AQUI APLICAMOS O FORMATO DA IMAGEM */}
                    <div className={`relative w-full ${aspectRatio} bg-gray-100 rounded-lg overflow-hidden border border-gray-200`}>
                        <img
                            src={url}
                            alt={label}
                            className={`w-full h-full ${objectFit}`} 
                        />
                    </div>
                    
                    {/* Botão de Remover (Aparece ao passar o mouse) */}
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                        <button
                            type="button"
                            onClick={removeImage}
                            className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-colors"
                            title="Remover imagem"
                        >
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition-colors cursor-pointer relative">
                    <div className="space-y-1 text-center">
                        {uploading ? (
                            <FontAwesomeIcon icon={faSpinner} spin className="mx-auto h-12 w-12 text-blue-500" />
                        ) : (
                            <FontAwesomeIcon icon={faImage} className="mx-auto h-12 w-12 text-gray-400" />
                        )}
                        <div className="flex text-sm text-gray-600 justify-center">
                            <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                                <span>{uploading ? 'Enviando...' : 'Carregar imagem'}</span>
                                <input 
                                    type="file" 
                                    className="sr-only" 
                                    accept="image/*" 
                                    onChange={uploadImage} 
                                    disabled={uploading} 
                                />
                            </label>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF até 5MB</p>
                    </div>
                </div>
            )}
        </div>
    );
}