// Caminho: components/bim/AutodeskViewerAPI.js
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

let viewerScriptLoading = false;
let viewerScriptLoaded = false;

function AutodeskViewerAPI({ urn, onViewerReady, onSelectionChange }) { 
  const viewerContainerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  
  const resizeTimeoutRef = useRef(null);

  // 1. Carregar Script de forma segura
  useEffect(() => {
    if (viewerScriptLoaded) {
        setScriptReady(true);
        return;
    }
    if (viewerScriptLoading) return;

    viewerScriptLoading = true;

    const loadScript = (src) => new Promise((resolve, reject) => {
        if (window.Autodesk?.Viewing) return resolve();
        const s = document.createElement('script'); 
        s.src = src; 
        s.onload = resolve; 
        s.onerror = reject;
        document.head.appendChild(s);
    });

    const loadStyle = (href) => { 
        const l = document.createElement('link'); 
        l.rel = 'stylesheet'; 
        l.href = href; 
        document.head.appendChild(l); 
    };

    loadStyle('https://developer.api.autodesk.com/modelderivative/v2/viewers/7.97/style.min.css');
    loadScript('https://developer.api.autodesk.com/modelderivative/v2/viewers/7.97/viewer3D.min.js')
        .then(() => {
            viewerScriptLoaded = true;
            viewerScriptLoading = false;
            setScriptReady(true);
        }).catch(err => {
            console.error("❌ Erro ao carregar scripts da Autodesk:", err);
            viewerScriptLoading = false;
        });
  }, []);

  // 2. Inicializar Motor do Viewer
  useEffect(() => {
    if (!scriptReady || !window.Autodesk) return;

    const options = {
        env: 'AutodeskProduction', 
        api: 'derivativeV2', 
        getAccessToken: async (cb) => {
            try {
                // Adicionamos um cache-control para evitar o 404/304 de cache maluco no servidor
                const res = await fetch('/api/aps/token', { cache: 'no-store' });
                if (!res.ok) throw new Error("Falha ao buscar token");
                const data = await res.json();
                cb(data.access_token, data.expires_in);
            } catch (err) {
                console.error("❌ Devonildo detectou erro no token:", err);
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
        const startedCode = viewer.start();
        
        if (startedCode > 0) {
            console.error("❌ Falha ao iniciar o container do Viewer");
            return;
        }

        viewerInstanceRef.current = viewer;
        
        viewer.setQualityLevel(false, false);
        viewer.setGhosting(false);
        viewer.setBackgroundColor(240, 242, 245, 240, 242, 245);

        // --- LISTENER DE SELEÇÃO ---
        viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => {
            if (onSelectionChange) {
                const dbIdArray = event.dbIdArray;
                const model = event.model; 
                
                if (dbIdArray.length > 0 && model) {
                    const modelUrn = model.getData()?.urn?.replace('urn:', '');
                    onSelectionChange(dbIdArray, modelUrn, model);
                } else {
                    onSelectionChange([], null, null);
                }
            }
        });

        // O SEGREDO: Avisar que está pronto apenas AGORA
        setIsInitialized(true);
        if (onViewerReady) {
            console.log("✅ Devonildo informa: Palco pronto! Viewer inicializado.");
            onViewerReady(viewer);
        }
    });

    // Cleanup para evitar duplicidade em Re-renders do Next.js 15
    return () => {
        if (viewerInstanceRef.current) {
            // Não damos finish() para não quebrar a navegação rápida, 
            // mas limpamos a ref se o componente for destruído
        }
    };
  }, [scriptReady, onViewerReady, onSelectionChange]);

  // 3. Carregar Modelo Principal (URN)
  useEffect(() => {
    const viewer = viewerInstanceRef.current;
    if (!viewer || !urn || !isInitialized) return;

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
        console.error("❌ Erro ao carregar documento URN:", err);
        setLoading(false);
    });

  }, [urn, isInitialized]); 

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
      {(!isInitialized || loading) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-50/60 backdrop-blur-[2px] text-blue-600">
              <div className="flex flex-col items-center gap-2">
                <FontAwesomeIcon icon={faSpinner} spin className="text-3xl"/>
                <span className="text-[10px] font-bold uppercase tracking-widest text-center">
                    {!isInitialized ? 'Iniciando Motor BIM...' : 'Sincronizando Geometria...'}
                </span>
              </div>
          </div>
      )}
      <div ref={viewerContainerRef} className="w-full h-full relative" />
      
      {!urn && isInitialized && !loading && (
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