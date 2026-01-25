// Caminho: components/bim/AutodeskViewerAPI.js
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

let viewerScriptLoaded = false;

function AutodeskViewerAPI({ urn, onViewerReady, onSelectionChange }) { 
  const viewerContainerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
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
        .then(() => {
            viewerScriptLoaded = true;
            setIsInitialized(true); 
        }).catch(console.error);
  }, []);

  // 2. Inicializar Motor do Viewer (Vista Soberana)
  useEffect(() => {
    if (!window.Autodesk || !viewerScriptLoaded) return;

    const options = {
        env: 'AutodeskProduction', 
        api: 'derivativeV2', 
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
        if (!div || viewerInstanceRef.current) return;

        const config3d = {
            loaderExtensions: { svf: "Autodesk.MemoryLimited" },
        };
        
        const viewer = new Autodesk.Viewing.GuiViewer3D(div, config3d);
        viewer.start();
        viewerInstanceRef.current = viewer;
        
        viewer.setQualityLevel(false, false);
        viewer.setGhosting(false);
        viewer.setBackgroundColor(240, 242, 245, 240, 242, 245);

        // --- LISTENER DE SELEÇÃO INTELIGENTE PARA VISTA FEDERADA ---
        viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => {
            if (onSelectionChange) {
                // O segredo: Pegamos o dbId e o model (que contém a URN)
                const dbIdArray = event.dbIdArray;
                const model = event.model; // Qual camada foi clicada
                
                if (dbIdArray.length > 0 && model) {
                    const modelUrn = model.getData()?.urn?.replace('urn:', '');
                    onSelectionChange(dbIdArray, modelUrn, model);
                } else {
                    onSelectionChange([], null, null);
                }
            }
        });

        if (onViewerReady) onViewerReady(viewer);
        setIsInitialized(true);
    });
  }, [onViewerReady, onSelectionChange]);

  // 3. Carregar Modelo Principal
  useEffect(() => {
    const viewer = viewerInstanceRef.current;
    if (!viewer || !urn) return;

    const currentUrn = viewer.model?.getData()?.urn;
    if (currentUrn === urn || currentUrn === 'urn:' + urn) return;

    setLoading(true);
    const docId = urn.startsWith('urn:') ? urn : 'urn:' + urn;

    Autodesk.Viewing.Document.load(docId, (doc) => {
        viewer.loadDocumentNode(doc, doc.getRoot().getDefaultGeometry()).then(() => {
            setLoading(false);
            viewer.fitToView();
        });
    }, (err) => {
        console.error("Erro ao carregar documento:", err);
        setLoading(false);
    });

  }, [urn]); 

  // 4. Redimensionamento
  useEffect(() => {
      const container = viewerContainerRef.current;
      if (!container) return;

      const resizeObserver = new ResizeObserver(() => {
          if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
          resizeTimeoutRef.current = setTimeout(() => {
              if (viewerInstanceRef.current) viewerInstanceRef.current.resize();
          }, 100); 
      });

      resizeObserver.observe(container);

      return () => {
          resizeObserver.disconnect();
          if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      };
  }, []);

  return (
    <div className="w-full h-full relative bg-gray-100 group overflow-hidden">
      {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-50/60 backdrop-blur-[2px] text-blue-600">
              <div className="flex flex-col items-center gap-2">
                <FontAwesomeIcon icon={faSpinner} spin className="text-3xl"/>
                <span className="text-[10px] font-bold uppercase tracking-widest text-center">Sincronizando<br/>Geometria Federada...</span>
              </div>
          </div>
      )}
      <div ref={viewerContainerRef} className="w-full h-full relative" />
      
      {!urn && !loading && isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.4em] opacity-30 italic">
                Vista Federada Studio 57
              </p>
          </div>
      )}
    </div>
  );
}

export default React.memo(AutodeskViewerAPI);