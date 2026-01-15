// components/shared/AnexoUploader.js
"use client";

import { useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faCloudUploadAlt } from '@fortawesome/free-solid-svg-icons';

export default function AnexoUploader({ parentId, storageBucket, tableName, allowedTipos, onUploadSuccess, categoria, organizacaoId }) {
    const supabase = createClient();
    const [file, setFile] = useState(null);
    const [descricao, setDescricao] = useState('');
    const [tipoId, setTipoId] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = async (selectedFile) => {
        if (!selectedFile) return;

        // Verifica se é imagem para otimizar
        if (!selectedFile.type.startsWith('image/')) { 
            setFile(selectedFile); 
            return; 
        }
        
        try {
            toast.info("Otimizando imagem...");
            // Configuração ajustada para mobile (menor uso de memória)
            const compressedFile = await imageCompression(selectedFile, { 
                maxSizeMB: 1.5, // Levemente reduzido para evitar crash em celulares antigos
                maxWidthOrHeight: 1920, 
                useWebWorker: true 
            });
            setFile(compressedFile);
            toast.success("Imagem otimizada!");
        } catch (error) {
            console.error('Erro ao comprimir imagem:', error);
            toast.error('Falha na otimização. Usando arquivo original.');
            setFile(selectedFile);
        }
    };

    const resetState = () => { 
        setFile(null); 
        setDescricao(''); 
        setTipoId(''); 
        if (fileInputRef.current) fileInputRef.current.value = ""; 
    };

    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        setIsDraggingOver(false); 
        if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]); 
    };

    // Função auxiliar para clicar no input (ajuda no mobile)
    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleUpload = async () => {
        if (!file || !tipoId) { toast.error("Selecione um tipo e um arquivo."); return; }
        if (!categoria || !parentId || !storageBucket || !tableName) { toast.error("Erro de configuração do componente."); return; }
        if (!organizacaoId) { toast.error("Erro de segurança: Organização não identificada."); return; }

        setIsUploading(true);
        const tipoSelecionado = allowedTipos.find(t => t.id == tipoId);
        const sigla = tipoSelecionado?.sigla || 'DOC';
        const fileExt = file.name.split('.').pop();
        // Nome único para evitar substituição
        const newFileName = `${parentId}/${sigla}_${Date.now()}.${fileExt}`;

        const promise = new Promise(async (resolve, reject) => {
            // Upload para o Storage
            const { error: uploadError } = await supabase.storage.from(storageBucket).upload(newFileName, file);
            if (uploadError) return reject(uploadError);

            // Registro no Banco de Dados
            const { data: dbData, error: dbError } = await supabase.from(tableName).insert({
                [tableName === 'empresa_anexos' ? 'empresa_id' : 'empreendimento_id']: parentId,
                caminho_arquivo: newFileName,
                nome_arquivo: file.name,
                descricao,
                tipo_documento_id: tipoId,
                categoria_aba: categoria,
                organizacao_id: organizacaoId
            }).select().single();
            
            if (dbError) return reject(dbError);
            resolve({ msg: "Anexo enviado com sucesso!", newAnexo: dbData });
        });

        toast.promise(promise, {
            loading: 'Enviando arquivo...',
            success: (result) => { 
                onUploadSuccess(result.newAnexo); 
                resetState(); 
                return result.msg; 
            },
            error: (err) => `Erro: ${err.message}`,
            finally: () => setIsUploading(false)
        });
    };

    return (
        <div className="p-4 bg-white border rounded-lg space-y-4 shadow-sm">
            <h4 className="font-semibold text-gray-700">Adicionar Novo Documento</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select 
                    value={tipoId} 
                    onChange={(e) => setTipoId(e.target.value)} 
                    className="p-2 border rounded-md w-full bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                    <option value="">-- Selecione o Tipo --</option>
                    {allowedTipos.map(t => (
                        <option key={t.id} value={t.id}>{t.descricao} ({t.sigla})</option>
                    ))}
                </select>
                
                <input 
                    type="text" 
                    placeholder="Descrição (opcional)" 
                    value={descricao} 
                    onChange={(e) => setDescricao(e.target.value)} 
                    className="p-2 border rounded-md w-full bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                />
            </div>

            <div 
                onDragEnter={handleDragEnter} 
                onDragLeave={handleDragLeave} 
                onDragOver={handleDragOver} 
                onDrop={handleDrop} 
                onClick={triggerFileInput} 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors duration-200 
                    ${isDraggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
                    active:bg-gray-200`} // Feedback visual de toque no mobile
            >
                {/* CORREÇÃO CRÍTICA PARA MOBILE: 
                    Usamos accept="* / *" (sem espaços) para garantir que o Android/iOS abra o seletor padrão 
                    (Câmera/Galeria/Arquivos) sem restrições que causam bugs.
                */}
                <input 
                    ref={fileInputRef} 
                    type="file" 
                    className="hidden" 
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    accept="*/*"
                />
                
                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-4xl text-gray-400 mb-3" />
                
                {file ? (
                    <div className="space-y-1">
                        <p className="font-semibold text-gray-700 break-all">{file.name}</p>
                        <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                        <p className="text-xs text-green-600 font-medium">Pronto para envio</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <p className="text-gray-600 font-medium">Toque para selecionar um arquivo</p>
                        <p className="text-sm text-gray-400">ou arraste e solte aqui</p>
                    </div>
                )}
            </div>

            <div className="flex justify-end">
                <button 
                    onClick={handleUpload} 
                    disabled={isUploading || !file || !tipoId} 
                    className={`
                        px-6 py-2 rounded-md text-white font-medium transition-all
                        ${isUploading || !file || !tipoId 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-700 active:transform active:scale-95 shadow-md'}
                    `}
                >
                    {isUploading ? (
                        <>
                            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                            Enviando...
                        </>
                    ) : (
                        <>
                            <FontAwesomeIcon icon={faUpload} className="mr-2" />
                            Enviar Anexo
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}