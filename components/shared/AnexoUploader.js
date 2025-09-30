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
        if (!selectedFile.type.startsWith('image/')) { setFile(selectedFile); return; }
        
        try {
            toast.info("Otimizando imagem...");
            const compressedFile = await imageCompression(selectedFile, { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true });
            setFile(compressedFile);
            toast.success("Imagem otimizada!");
        } catch (error) {
            console.error('Erro ao comprimir imagem:', error);
            toast.error('Falha na otimização. Usando arquivo original.');
            setFile(selectedFile);
        }
    };

    const resetState = () => { setFile(null); setDescricao(''); setTipoId(''); if (fileInputRef.current) fileInputRef.current.value = ""; };
    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]); };

    const handleUpload = async () => {
        if (!file || !tipoId) { toast.error("Selecione um tipo e um arquivo."); return; }
        if (!categoria || !parentId || !storageBucket || !tableName) { toast.error("Erro de configuração do componente."); return; }
        if (!organizacaoId) { toast.error("Erro de segurança: Organização não identificada."); return; }

        setIsUploading(true);
        const tipoSelecionado = allowedTipos.find(t => t.id == tipoId);
        const sigla = tipoSelecionado?.sigla || 'DOC';
        const fileExt = file.name.split('.').pop();
        const newFileName = `${parentId}/${sigla}_${Date.now()}.${fileExt}`;

        const promise = new Promise(async (resolve, reject) => {
            const { error: uploadError } = await supabase.storage.from(storageBucket).upload(newFileName, file);
            if (uploadError) return reject(uploadError);

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
            resolve({ msg: "Anexo enviado!", newAnexo: dbData });
        });

        toast.promise(promise, {
            loading: 'Enviando arquivo...',
            success: (result) => { onUploadSuccess(result.newAnexo); resetState(); return result.msg; },
            error: (err) => `Erro: ${err.message}`,
            finally: () => setIsUploading(false)
        });
    };

    return (
        <div className="p-4 bg-white border rounded-lg space-y-4">
            <h4 className="font-semibold text-gray-700">Adicionar Novo Documento</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className="p-2 border rounded-md w-full"><option value="">-- Selecione o Tipo --</option>{allowedTipos.map(t => <option key={t.id} value={t.id}>{t.descricao} ({t.sigla})</option>)}</select>
                <input type="text" placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="p-2 border rounded-md w-full" />
            </div>
            <div onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDraggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}>
                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e.target.files[0])} />
                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-4xl text-gray-400 mb-3" />
                {file ? (<div><p className="font-semibold text-gray-700">{file.name}</p><p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p></div>) : (<p className="text-gray-500">Arraste e solte, ou <span className="text-blue-600 font-semibold">clique para selecionar</span>.</p>)}
            </div>
            <div className="flex justify-end">
                <button onClick={handleUpload} disabled={isUploading || !file || !tipoId} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                    {isUploading ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> : <FontAwesomeIcon icon={faUpload} className="mr-2" />}
                    {isUploading ? 'Enviando...' : 'Enviar'}
                </button>
            </div>
        </div>
    );
}