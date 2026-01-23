// Caminho: app/components/bim/AutodeskViewerAPI.js
'use client';

import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faSpinner, faLayerGroup, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';

// Variável global para evitar recarregamento do script da Autodesk
let viewerScriptLoaded = false;

export default function AutodeskViewerAPI({ urn }) {
  const viewerContainerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Aguardando Modelo...');

  // 1. Carregar os Scripts da Autodesk (v7.97 Estável)
  useEffect(() => {
    if (viewerScriptLoaded) return;

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (window.Autodesk && window.Autodesk.Viewing) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    const loadStyle = (href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    };

    // Usando versão específica 7.97 para estabilidade
    loadStyle('https://developer.api.autodesk.com/modelderivative/v2/viewers/7.97/style.min.css');
    
    loadScript('https://developer.api.autodesk.com/modelderivative/v2/viewers/7.97/viewer3D.min.js')
      .then(() => {
        viewerScriptLoaded = true;
      })
      .catch(err => console.error("Erro ao carregar script Autodesk:", err));

  }, []);

  // 2. Inicializar o Viewer quando o URN mudar
  useEffect(() => {
    if (!urn || !window.Autodesk) return;

    setLoading(true);
    setStatus('Autenticando...');

    // Função para pegar o Token da nossa API
    const getAccessToken = async (callback) => {
        try {
            const response = await fetch('/api/aps/token');
            const data = await response.json();
            callback(data.access_token, data.expires_in);
        } catch (err) {
            console.error("Erro ao pegar token:", err);
            setStatus('Erro de Token');
        }
    };

    // --- CORREÇÃO AQUI: Usar ambiente 'AutodeskProduction' (SVF Padrão) ---
    const options = {
      env: 'AutodeskProduction', 
      api: 'derivativeV2',       
      getAccessToken: getAccessToken,
    };

    Autodesk.Viewing.Initializer(options, () => {
      // Se já existir instância, desmonta para criar nova (limpeza)
      if (viewerInstanceRef.current) {
        // Tenta fechar corretamente para evitar vazamento de memória
        try {
            viewerInstanceRef.current.finish();
        } catch(e) {}
        viewerInstanceRef.current = null;
      }

      setStatus('Carregando Geometria...');
      
      const viewerDiv = viewerContainerRef.current;
      // GuiViewer3D adiciona a barra de ferramentas automaticamente
      const viewer = new Autodesk.Viewing.GuiViewer3D(viewerDiv);
      
      viewer.start();
      viewerInstanceRef.current = viewer;

      // Adiciona o prefixo necessário 'urn:'
      const documentId = urn.startsWith('urn:') ? urn : 'urn:' + urn;

      Autodesk.Viewing.Document.load(documentId, 
        (doc) => {
            setStatus('Renderizando...');
            // Carrega a geometria padrão (geralmente a visualização 3D principal)
            const defaultModel = doc.getRoot().getDefaultGeometry();
            
            if (!defaultModel) {
                setStatus('Erro: Modelo vazio ou sem 3D');
                setLoading(false);
                return;
            }

            viewer.loadDocumentNode(doc, defaultModel).then(() => {
                setLoading(false);
                setStatus('Pronto');
                // Ajustes visuais
                viewer.setLightPreset(2); 
                viewer.setQualityLevel(false, true);
                viewer.fitToView(); // Centraliza o modelo
            });
        },
        (errorCode, errorMsg) => {
            console.error('Erro ao carregar documento:', errorCode, errorMsg);
            setLoading(false);
            // Códigos comuns: 1, 2, 3 (arquivo não encontrado ou ainda traduzindo)
            setStatus('Processando na Autodesk... Aguarde 1 min e atualize.');
        }
      );
    });

    // Cleanup ao desmontar componente
    return () => {
        if (viewerInstanceRef.current) {
            try {
                viewerInstanceRef.current.finish();
            } catch(e) {}
            viewerInstanceRef.current = null;
        }
    };

  }, [urn]);

  return (
    <div className="w-full bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700 flex flex-col h-full relative">
      
      {/* Barra de Título */}
      <div className="bg-black text-white px-4 py-3 flex items-center justify-between border-b border-gray-800 z-10">
        <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded">
                <FontAwesomeIcon icon={faCube} className="text-white text-sm" />
            </div>
            <div>
                <h3 className="font-bold text-sm tracking-wide uppercase text-gray-200">Studio 57 BIM Manager</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                   {urn ? 'Visualizador Ativo' : 'Aguardando Seleção'}
                </p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {loading && <span className="text-xs text-orange-500 animate-pulse font-mono">{status}</span>}
            <div className="bg-gray-800 p-1 rounded">
                <FontAwesomeIcon icon={faLayerGroup} className="text-gray-400 text-xs" />
            </div>
        </div>
      </div>

      {/* Container do Canvas 3D */}
      <div className="relative w-full h-[600px] md:h-[80vh] bg-gray-200 group">
        
        {/* Placeholder se não houver URN */}
        {!urn && !loading && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-900">
                <FontAwesomeIcon icon={faCube} className="text-6xl mb-4 opacity-20" />
                <p>Nenhum modelo selecionado</p>
             </div>
        )}

        {/* Loading Overlay */}
        {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-gray-900/90 backdrop-blur-sm text-white">
                <FontAwesomeIcon icon={faSpinner} className="text-5xl text-blue-500 animate-spin mb-4" />
                <p className="text-gray-300 font-light tracking-widest text-sm animate-pulse uppercase">{status}</p>
                {status.includes('Processando') && (
                    <p className="text-xs text-yellow-500 mt-2 max-w-xs text-center">
                        <FontAwesomeIcon icon={faExclamationCircle} /> O primeiro carregamento demora pois a Autodesk está convertendo o arquivo.
                    </p>
                )}
            </div>
        )}

        {/* Onde a Autodesk vai injetar o Canvas */}
        <div ref={viewerContainerRef} className="w-full h-full relative" />
        
      </div>
    </div>
  );
}