// components/ui/UppyAvatarUploader.js
// Uploader de imagem nativo (sem @uppy/react/dashboard)
"use client";

import { useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faTrash, faSpinner, faImage, faPen, faXmark } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function UppyAvatarUploader({
    url,
    onUpload,
    bucketName = 'empreendimentos',
    folderPath = 'capas',
    label = "Imagem de Capa (Thumbnail)",
    aspectRatio = "aspect-video",
    objectFit = "object-cover",
    className = ""
}) {
    const supabase = createClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);

    const hasWidthClass = className && /\bw-(?:full|screen|px|\d+|auto|min|max|fit)\b/.test(className);
    const rootClasses = hasWidthClass ? className : `w-full ${className}`.trim();

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Apenas imagens são permitidas.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Imagem muito grande. Máximo: 5MB.');
            return;
        }
        setSelectedFile(file);
        setPreview(URL.createObjectURL(file));
        // limpa o input para re-selecionar o mesmo arquivo se necessário
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) { toast.error('Apenas imagens são permitidas.'); return; }
            if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande. Máximo: 5MB.'); return; }
            setSelectedFile(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setIsUploading(true);

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) { toast.error('Erro de autenticação.'); return; }

            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(7)}_${Date.now()}.${fileExt}`;
            const fullPath = `${folderPath}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(fullPath, selectedFile, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from(bucketName).getPublicUrl(fullPath);

            if (onUpload) onUpload(data.publicUrl);
            toast.success('Imagem alterada com sucesso!');
            handleClose();
        } catch (err) {
            console.error(err);
            toast.error(`Erro ao enviar: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        setIsModalOpen(false);
        setSelectedFile(null);
        setPreview(null);
    };

    const removeImage = () => {
        if (onUpload) onUpload(null);
        toast.info('Imagem removida.');
    };

    return (
        <div className={rootClasses}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}

            {/* Preview */}
            <div className="relative group cursor-pointer" onClick={() => !url && setIsModalOpen(true)}>
                <div className={`relative w-full ${aspectRatio} bg-gray-50 rounded-lg overflow-hidden border-2 flex items-center justify-center transition-all ${url ? 'border-gray-200 hover:border-blue-400' : 'border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50'}`}>
                    {url ? (
                        <>
                            <img src={url} alt={label} className={`w-full h-full ${objectFit}`} />
                            <div
                                className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
                            >
                                <div className="bg-white text-blue-600 px-3 py-1.5 rounded-md font-medium text-sm flex items-center gap-2 shadow-sm">
                                    <FontAwesomeIcon icon={faPen} /> Alterar
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center p-2">
                            <FontAwesomeIcon icon={faImage} className="mx-auto h-6 w-6 text-gray-400 mb-1 group-hover:text-blue-500 transition-colors" />
                            <p className="text-xs font-medium text-gray-600 group-hover:text-blue-600 transition-colors leading-tight">Add. Imagem</p>
                        </div>
                    )}
                </div>
                {url && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeImage(); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-colors z-10 w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100"
                        title="Remover imagem"
                    >
                        <FontAwesomeIcon icon={faTrash} className="text-sm" />
                    </button>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col">
                        {/* Header */}
                        <div className="flex justify-between items-center px-5 py-4 border-b">
                            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-blue-500" />
                                {url ? 'Alterar' : 'Enviar'} {label}
                            </h2>
                            <button onClick={handleClose} className="text-gray-400 hover:text-red-500 hover:bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                                <FontAwesomeIcon icon={faXmark} size="lg" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            {preview ? (
                                <div className="flex flex-col items-center gap-4">
                                    <img src={preview} alt="Pré-visualização" className="w-full max-h-60 object-contain rounded-lg border border-gray-200 shadow-sm" />
                                    <button
                                        onClick={() => { setSelectedFile(null); setPreview(null); }}
                                        className="text-xs text-red-500 hover:text-red-700 font-semibold underline"
                                    >
                                        Escolher outra imagem
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={(e) => e.preventDefault()}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
                                >
                                    <div className="bg-blue-100 w-14 h-14 rounded-full flex items-center justify-center">
                                        <FontAwesomeIcon icon={faImage} className="text-blue-500 text-2xl" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-gray-700">Clique ou arraste a imagem aqui</p>
                                        <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP — máx. 5MB</p>
                                    </div>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 px-5 pb-5">
                            <button
                                onClick={handleClose}
                                disabled={isUploading}
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={!selectedFile || isUploading}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                            >
                                {isUploading ? <><FontAwesomeIcon icon={faSpinner} spin /> Enviando...</> : 'Confirmar Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
