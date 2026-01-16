// app/(main)/upload/page.js
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faSpinner, faCheckCircle, faArrowLeft, faFileAlt } from '@fortawesome/free-solid-svg-icons';

export default function UploadPage() {
  const supabase = createClient();
  
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Feedback imediato para saber se o Android entregou o arquivo
      toast.info(`Selecionado: ${selectedFile.name} (${(selectedFile.size/1024).toFixed(1)} KB)`);
    }
  };

  // Função mágica para ler o arquivo e garantir que ele existe na memória
  const fileToBlob = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Cria um novo Blob (arquivo na memória) a partir da leitura
        const blob = new Blob([reader.result], { type: file.type || 'application/octet-stream' });
        resolve(blob);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      toast.warning('Selecione um arquivo primeiro.');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Iniciando envio...');

    try {
        let fileToUpload = file;

        // 1. ESTRATÉGIA DE IMAGEM (Já funcionava)
        if (file.type.startsWith('image/')) {
            toast.loading('Otimizando imagem...', { id: toastId });
            try {
                const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
                fileToUpload = await imageCompression(file, options);
            } catch (err) {
                console.warn("Falha compressão img:", err);
            }
        } 
        // 2. ESTRATÉGIA PARA ARQUIVOS (TXT, PDF) - A CORREÇÃO! 🛠️
        else {
            toast.loading('Processando arquivo para memória...', { id: toastId });
            // Aqui está o segredo: Lemos o arquivo para a memória ANTES de enviar
            // Isso evita que o link do Android se perca.
            try {
                fileToUpload = await fileToBlob(file);
            } catch (readErr) {
                throw new Error("Não foi possível ler o arquivo. Tente outro.");
            }
        }

        // 3. Envio para o Storage
        toast.loading('Enviando bytes...', { id: toastId });
        
        const fileExt = file.name.split('.').pop();
        const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_'); 
        const newFileName = `${Date.now()}_${cleanName}.${fileExt}`;
        const filePath = `public/${newFileName}`;

        const { data: fileData, error: fileError } = await supabase.storage
            .from('marca')
            .upload(filePath, fileToUpload, { 
                cacheControl: '3600', 
                upsert: false,
                contentType: file.type || 'text/plain' // Garante que tem tipo
            });

        if (fileError) throw new Error(`Erro Storage: ${fileError.message}`);

        // 4. Salvar no Banco
        const { error: dbError } = await supabase
            .from('marcas_uploads')
            .insert([{
                descricao: description || file.name,
                caminho_arquivo: fileData.path,
            }]);
        
        if (dbError) throw new Error(`Erro Banco: ${dbError.message}`);

        toast.success('Sucesso! Arquivo salvo.', { id: toastId });
        
        // Reset
        setFile(null);
        setDescription('');
        if(document.getElementById('file-input')) document.getElementById('file-input').value = "";

    } catch (error) {
        console.error(error);
        toast.error(`Erro: ${error.message}`, { id: toastId });
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      <main className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
        
        <div className="p-6 bg-indigo-600 text-white">
            <Link href="/" className="text-white/80 hover:text-white flex items-center gap-2 text-sm mb-4 font-bold">
                <FontAwesomeIcon icon={faArrowLeft} /> Voltar
            </Link>
            <h1 className="text-2xl font-bold">Upload Blindado 🛡️</h1>
            <p className="text-indigo-100 text-sm">Lê na memória antes de enviar.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input 
                    type="text" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Descrição do arquivo"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo</label>
                <label 
                    htmlFor="file-input" 
                    className={`
                        flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                        ${isUploading ? 'bg-gray-100 border-gray-300 opacity-50' : 'border-indigo-300 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200'}
                    `}
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {isUploading ? (
                            <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-indigo-500 mb-2" />
                        ) : file ? (
                            <div className="text-center">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-3xl text-green-600 mb-2" />
                                <p className="text-xs text-gray-500 break-all px-2 font-bold">{file.name}</p>
                                <p className="text-[10px] text-gray-400">{(file.size/1024).toFixed(1)} KB</p>
                            </div>
                        ) : (
                            <>
                                <FontAwesomeIcon icon={faFileAlt} className="text-3xl text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500 font-medium">Toque para selecionar</p>
                                <p className="text-xs text-gray-400">Fotos, PDF ou TXT</p>
                            </>
                        )}
                    </div>
                    
                    {/* Mantemos accept aberto para o Android não bloquear */}
                    <input 
                        id="file-input" 
                        type="file" 
                        onChange={handleFileChange} 
                        accept="*/*" 
                        className="hidden" 
                        disabled={isUploading}
                    />
                </label>
            </div>

            <button 
                type="submit" 
                disabled={isUploading || !file}
                className={`
                    w-full py-3 px-4 rounded-lg text-white font-bold shadow-md transition-transform active:scale-95
                    ${isUploading || !file ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}
                `}
            >
                {isUploading ? 'Processando...' : 'Enviar Agora'}
            </button>

        </form>
      </main>
    </div>
  );
}