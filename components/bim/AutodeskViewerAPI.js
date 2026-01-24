// Caminho: components/bim/AutodeskViewerAPI.js
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

let viewerScriptLoaded = false;

function AutodeskViewerAPI({ urn, onViewerReady }) { 
  const viewerContainerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [loading, setLoading] = useState(false);
  
  // Referência para guardar o timer do debounce
  const resizeTimeoutRef = useRef(null);

  // 1. Carregar Script (Apenas uma vez)
  useEffect(() => {
    if (viewerScriptLoaded) return;
    const loadScript = (src) => new Promise((resolve) => {
        if (window.Autodesk?.Viewing) return resolve();
        const s = document.createElement('script'); s.src=src; s.onload=resolve; document.head.appendChild(s);
    });
    const loadStyle = (href) => { 
        const l = document.createElement('link'); l.rel='stylesheet'; l.href=href; document.head.appendChild(l); 
    };
    loadStyle('https://developer.api.autodesk.com/modelderivative/v2/viewers/7.97/style.min.css');
    loadScript('https://developer.api.autodesk.com/modelderivative/v2/viewers/7.97/viewer3D.min.js')
        .then(() => viewerScriptLoaded = true).catch(console.error);
  }, []);

  // 2. Inicializar Viewer
  useEffect(() => {
    if (!urn || !window.Autodesk) return;

    // SE O VIEWER JÁ EXISTE:
    if (viewerInstanceRef.current?.model?.getData()?.urn === urn || 
        viewerInstanceRef.current?.model?.getData()?.urn === 'urn:'+urn) {
        
        // Apenas notifica o pai, mas não roda tudo de novo
        if (onViewerReady && viewerInstanceRef.current) {
            onViewerReady(viewerInstanceRef.current);
        }
        return;
    }

    setLoading(true);
    
    const options = {
        env: 'AutodeskProduction', api: 'derivativeV2', 
        getAccessToken: async (cb) => {
            try {
                const res = await fetch('/api/aps/token');
                const data = await res.json();
                cb(data.access_token, data.expires_in);
            } catch (err) {
                console.error("Erro token:", err);
            }
        }
    };

    Autodesk.Viewing.Initializer(options, () => {
        const div = viewerContainerRef.current;
        if (!div) return;

        let viewer = viewerInstanceRef.current;
        if (!viewer) {
            // Otimizações de Performance na Configuração
            const config3d = {
                loaderExtensions: { svf: "Autodesk.MemoryLimited" }, // Usa menos memória
            };
            
            viewer = new Autodesk.Viewing.GuiViewer3D(div, config3d);
            viewer.start();
            viewerInstanceRef.current = viewer;
            
            // Configurações visuais para ficar mais leve
            viewer.setQualityLevel(false, false); // Desliga sombras pesadas
            viewer.setGhosting(false);
        }

        // Expõe a instância IMEDIATAMENTE após criação
        if (onViewerReady) onViewerReady(viewer);

        const docId = urn.startsWith('urn:') ? urn : 'urn:' + urn;
        Autodesk.Viewing.Document.load(docId, (doc) => {
            viewer.loadDocumentNode(doc, doc.getRoot().getDefaultGeometry()).then(() => {
                setLoading(false);
                // Configurações pós-load
                viewer.fitToView();
                viewer.setBackgroundColor(249, 250, 251, 249, 250, 251); // Cinza claro (bg-gray-50)
            });
        });
    });

    // CORREÇÃO CRÍTICA: Removemos onViewerReady das dependências para evitar loop infinito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urn]); 

  // 3. RESIZE OBSERVER INTELIGENTE (Com Debounce)
  useEffect(() => {
      const container = viewerContainerRef.current;
      if (!container) return;

      const resizeObserver = new ResizeObserver(() => {
          // DEBOUNCE: Limpa o timer anterior
          if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);

          // Espera 100ms depois que a animação parar para redimensionar o Canvas 3D
          resizeTimeoutRef.current = setTimeout(() => {
              if (viewerInstanceRef.current) {
                  viewerInstanceRef.current.resize();
              }
          }, 100); 
      });

      resizeObserver.observe(container);

      return () => {
          resizeObserver.disconnect();
          if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      };
  }, []);

  return (
    <div className="w-full h-full relative bg-gray-50 group overflow-hidden">
      {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm text-blue-600">
              <FontAwesomeIcon icon={faSpinner} spin className="text-3xl"/>
          </div>
      )}
      <div ref={viewerContainerRef} className="w-full h-full relative" />
    </div>
  );
}

// Memoização para evitar re-renders do componente React
export default React.memo(AutodeskViewerAPI, (prev, next) => prev.urn === next.urn);