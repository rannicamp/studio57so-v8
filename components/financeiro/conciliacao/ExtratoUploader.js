// components/financeiro/conciliacao/ExtratoUploader.js
"use client";

import React, { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCloudUploadAlt, faFileCode, faSpinner, faPaste, faFileCsv, faFilePdf, faRobot 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function ExtratoUploader({ onFileLoaded }) {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('upload'); 
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Lendo arquivo...');
  const [pastedText, setPastedText] = useState('');

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length) processFile(files[0]);
  };

  // --- Função Mágica de Reparo de Texto ---
  // Se lermos um arquivo UTF-8 como ISO-8859-1, ele gera caracteres como 'Ã£'.
  // Essa função detecta isso e corrige, garantindo que funcione para ambos os casos.
  const repararTexto = (texto) => {
      if (!texto) return '';
      try {
          // Tenta decodificar o "Mojibake" (UTF-8 lido como Latin1)
          // Se o texto parecer "quebrado" (ex: Ã¡, Ã£), isso conserta.
          return decodeURIComponent(escape(texto));
      } catch (e) {
          // Se der erro, é porque o texto já estava certo (era ISO-8859-1 puro)
          return texto;
      }
  };

  const processFile = async (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    
    if (!['ofx', 'csv', 'pdf'].includes(extension)) {
      toast.error('Apenas arquivos .OFX, .CSV ou .PDF são permitidos.');
      return;
    }

    setIsLoading(true);

    // --- FLUXO 1: PDF (Via IA) ---
    if (extension === 'pdf') {
        setLoadingMessage('A IA está lendo sua fatura...');
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/extract-pdf', {
                method: 'POST',
                body: formData,
            });

            // LÊ O ERRO REAL DO SERVIDOR
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Erro desconhecido no servidor" }));
                throw new Error(errorData.error || `Erro ${response.status}: Falha na comunicação com a IA`);
            }

            const data = await response.json();
            
            if (data.csv) {
                onFileLoaded({ 
                    name: `${file.name} (Processado por IA)`, 
                    content: data.csv, 
                    extension: 'csv' 
                });
                toast.success('PDF processado com sucesso!');
            } else {
                throw new Error('A IA não retornou dados válidos.');
            }

        } catch (error) {
            console.error("Erro no Uploader:", error);
            // Agora o toast vai mostrar o motivo exato!
            toast.error(error.message);
        } finally {
            setIsLoading(false);
            setLoadingMessage('Lendo arquivo...');
        }
        return;
    }

    // --- FLUXO 2: OFX / CSV (Leitura Local) ---
    const reader = new FileReader();
    
    reader.onload = (e) => {
      // 1. Pegamos o conteúdo bruto lido como ISO-8859-1
      const rawContent = e.target.result;
      
      // 2. Passamos pelo reparador para garantir que acentos fiquem certos
      const content = repararTexto(rawContent);

      setTimeout(() => {
        setIsLoading(false);
        onFileLoaded({ name: file.name, content, extension });
      }, 500);
    };

    // CORREÇÃO AQUI: Forçamos a leitura como ISO-8859-1 (padrão dos bancos brasileiros)
    // Isso evita que 'DÉBITO' vire 'D?BITO' ou 'DBITO'.
    reader.readAsText(file, 'ISO-8859-1');
  };

  const handleProcessText = () => {
    if (!pastedText.trim()) {
        toast.warning("A área de texto está vazia.");
        return;
    }
    setIsLoading(true);
    setTimeout(() => {
        setIsLoading(false);
        onFileLoaded({ 
            name: "Texto Importado (Via Colar)", 
            content: pastedText, 
            extension: 'csv' 
        });
    }, 500);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
            <button 
                onClick={() => setMode('upload')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === 'upload' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <FontAwesomeIcon icon={faCloudUploadAlt} /> Upload Arquivo
            </button>
            <button 
                onClick={() => setMode('paste')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${mode === 'paste' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <FontAwesomeIcon icon={faPaste} /> Colar CSV
            </button>
        </div>

        <div className="p-6">
            {mode === 'upload' && (
                <div 
                  className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer group h-64 flex flex-col items-center justify-center ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                >
                  <input 
                    type="file" ref={fileInputRef} className="hidden" accept=".ofx,.csv,.pdf" 
                    onChange={(e) => e.target.files.length && processFile(e.target.files[0])}
                    disabled={isLoading}
                  />

                  {isLoading ? (
                    <div className="flex flex-col items-center animate-pulse">
                        <div className="relative">
                            <FontAwesomeIcon icon={faSpinner} spin className="text-5xl text-blue-500 mb-3" />
                            <FontAwesomeIcon icon={faRobot} className="text-xl text-purple-500 absolute -bottom-1 -right-1 bg-white rounded-full p-1 border border-purple-200" />
                        </div>
                        <p className="text-gray-600 font-bold mt-2">{loadingMessage}</p>
                        <p className="text-xs text-gray-400">Isso pode levar alguns segundos...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-3 mb-4 group-hover:scale-110 transition-transform">
                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faFileCode} className="text-xl" />
                        </div>
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faFilePdf} className="text-xl" />
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-gray-700">Arraste Extrato (OFX/CSV) ou Fatura (PDF)</h3>
                      <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">A IA identifica automaticamente arquivos PDF.</p>
                    </>
                  )}
                </div>
            )}

            {mode === 'paste' && (
                <div className="flex flex-col h-64">
                    <textarea
                        className="flex-1 w-full p-4 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-gray-50 focus:bg-white transition-colors"
                        placeholder={`Cole aqui o conteúdo do seu CSV...\nExemplo:\nData,Descrição,Valor\n2023-10-01,Pagamento Aluguel,-1500.00`}
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                    ></textarea>
                    <button 
                        onClick={handleProcessText}
                        disabled={isLoading || !pastedText.trim()}
                        className="mt-4 w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? <><FontAwesomeIcon icon={faSpinner} spin /> Processando...</> : <><FontAwesomeIcon icon={faFileCsv} /> Processar Dados Colados</>}
                    </button>
                </div>
            )}
        </div>
    </div>
  );
}