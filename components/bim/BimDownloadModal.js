'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, faDownload, faSpinner, faCheck, 
  faTriangleExclamation, faInfoCircle 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimDownloadModal({ isOpen, onClose, file }) {
  const [ifcStatus, setIfcStatus] = useState('checking'); // 'checking' | 'ready' | 'processing' | 'not_started' | 'failed'
  const [downloadUrl, setDownloadUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState('');

  const isOriginalIfc = file
    ? (file.nome_arquivo.toLowerCase().endsWith('.ifc') || file.nome_arquivo.toLowerCase().includes('.ifc.rvt'))
    : false;

  const filenameBase = file 
    ? file.nome_arquivo.replace(/\.[^/.]+$/, "") 
    : '';

  useEffect(() => {
    let timeoutId;
    let isActive = true;

    if (!isOpen || !file) return;

    const checkIfcAvailability = async () => {
      try {
        const res = await fetch(
          `/api/aps/download-ifc?urn=${encodeURIComponent(file.urn_autodesk)}&isOriginalIfc=${isOriginalIfc}&filename=${encodeURIComponent(filenameBase + '.ifc')}`
        );
        
        if (!isActive) return;

        if (!res.ok) {
          throw new Error(`Erro na API: ${res.statusText}`);
        }

        const data = await res.json();
        
        if (data.success && data.downloadUrl) {
          setIfcStatus('ready');
          setDownloadUrl(data.downloadUrl);
        } else if (data.status === 'processing') {
          setIfcStatus('processing');
          setProgress(data.progress || 'Iniciando...');
          // Executar polling a cada 5s
          timeoutId = setTimeout(checkIfcAvailability, 5000);
        } else if (data.status === 'not_started') {
          setIfcStatus('not_started');
        } else {
          setIfcStatus('failed');
          setErrorMessage(data.error || 'Falha ao buscar IFC.');
        }
      } catch (err) {
        if (!isActive) return;
        setIfcStatus('failed');
        setErrorMessage(err.message || 'Erro de conexão.');
      }
    };

    setIfcStatus('checking');
    setDownloadUrl('');
    setErrorMessage('');
    setProgress('');
    
    checkIfcAvailability();

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen, file, isOriginalIfc, filenameBase]);

  const dispararConversao = async () => {
    if (!file) return;
    setIfcStatus('processing');
    setProgress('Disparando conversão...');

    try {
      const res = await fetch(`/api/aps/download-ifc?urn=${encodeURIComponent(file.urn_autodesk)}&filename=${encodeURIComponent(filenameBase + '.ifc')}`);
      const data = await res.json();

      if (data.status === 'processing') {
        toast.info("A conversão para IFC foi iniciada! Aguarde a conclusão no próprio modal.");
        // A checagem do useEffect já estará agendada para rodar
      } else if (data.success && data.downloadUrl) {
        setIfcStatus('ready');
        setDownloadUrl(data.downloadUrl);
        toast.success("O arquivo IFC já está pronto!");
      } else {
        setIfcStatus('failed');
        setErrorMessage(data.error || 'Falha ao iniciar tradução.');
      }
    } catch (err) {
      setIfcStatus('failed');
      setErrorMessage(err.message || 'Erro ao disparar tradução.');
    }
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all scale-100 border border-gray-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider">
            <FontAwesomeIcon icon={faDownload} className="text-blue-600" />
            Baixar Arquivos do Modelo
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Modelo Selecionado</p>
            <p className="text-xs font-bold text-gray-700 truncate" title={file.nome_arquivo}>{file.nome_arquivo}</p>
            <p className="text-[9px] text-gray-400 mt-1 font-semibold">
              Versão Atual: v{file.versao} • Upload em: {new Date(file.criado_em || file.criado_at).toLocaleDateString('pt-BR')}
            </p>
          </div>

          <div className="space-y-4">
            {/* Opção RVT */}
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all
              ${isOriginalIfc 
                ? 'bg-gray-50 border-gray-150 opacity-60' 
                : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'
              }`}
            >
              <div>
                <p className="text-xs font-black text-gray-700">Modelo Revit (.RVT)</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {isOriginalIfc ? 'Indisponível (arquivo original enviado em .IFC)' : 'Arquivo original enviado no upload'}
                </p>
              </div>

              {!isOriginalIfc ? (
                <a 
                  href={`/api/aps/download-rvt?urn=${file.urn_autodesk}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <FontAwesomeIcon icon={faDownload} />
                  Baixar
                </a>
              ) : (
                <span className="px-3 py-1.5 bg-gray-200 text-gray-400 text-[10px] font-extrabold rounded-lg select-none">
                  Bloqueado
                </span>
              )}
            </div>

            {/* Opção IFC */}
            <div className="p-4 rounded-xl border bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm flex items-center justify-between gap-4 transition-all">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-gray-700">Modelo IFC (.IFC)</p>
                <div className="mt-1">
                  {ifcStatus === 'checking' && (
                    <span className="text-[9px] text-blue-500 font-extrabold flex items-center gap-1">
                      <FontAwesomeIcon icon={faSpinner} spin />
                      Verificando disponibilidade na Autodesk...
                    </span>
                  )}
                  {ifcStatus === 'processing' && (
                    <span className="text-[9px] text-amber-500 font-extrabold flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faSpinner} spin />
                      Convertendo para IFC na Autodesk ({progress === 'complete' ? '100%' : progress})...
                    </span>
                  )}
                  {ifcStatus === 'ready' && (
                    <span className="text-[9px] text-green-600 font-extrabold flex items-center gap-1">
                      <FontAwesomeIcon icon={faCheck} />
                      Arquivo IFC disponível e assinado.
                    </span>
                  )}
                  {ifcStatus === 'not_started' && (
                    <span className="text-[9px] text-gray-450 font-bold flex items-center gap-1">
                      <FontAwesomeIcon icon={faInfoCircle} />
                      IFC ainda não gerado para este modelo antigo.
                    </span>
                  )}
                  {ifcStatus === 'failed' && (
                    <span className="text-[9px] text-red-500 font-bold flex items-center gap-1">
                      <FontAwesomeIcon icon={faTriangleExclamation} />
                      {errorMessage}
                    </span>
                  )}
                </div>
              </div>

              <div>
                {ifcStatus === 'ready' && (
                  <a 
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 animate-in fade-in"
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    Baixar
                  </a>
                )}
                {ifcStatus === 'not_started' && (
                  <button 
                    onClick={dispararConversao}
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-black rounded-lg transition-colors border border-blue-200/50"
                  >
                    Gerar IFC
                  </button>
                )}
                {(ifcStatus === 'checking' || ifcStatus === 'processing') && (
                  <div className="w-16 h-8 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400 text-xs" />
                  </div>
                )}
                {ifcStatus === 'failed' && (
                  <button 
                    onClick={dispararConversao}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-black rounded-lg transition-colors border border-red-200/50"
                  >
                    Tentar Novamente
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
          <button 
            onClick={onClose} 
            className="px-5 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-all"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
