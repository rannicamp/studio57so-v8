// Caminho: components/bim/AutodeskViewerAPI.js
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faSpinner, faMousePointer } from '@fortawesome/free-solid-svg-icons';

let viewerScriptLoaded = false;

function AutodeskViewerAPI({ urn }) {
  const viewerContainerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Aguardando...');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (viewerScriptLoaded) return;
    const loadScript = (src) => new Promise((resolve, reject) => {
        if (window.Autodesk && window.Autodesk.Viewing) { resolve(); return; }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    const loadStyle = (href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    };
    loadStyle('https://developer.api.autodesk.com/modelderivative/v2/viewers/7.97/style.min.css');
    loadScript('https://developer.api.autodesk.com/modelderivative/v2/viewers/7.97/viewer3D.min.js')
      .then(() => { viewerScriptLoaded = true; })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (!urn || !window.Autodesk) return;

    // A MÁGICA: Se o modelo já é o mesmo, NÃO FAZ NADA.
    if (viewerInstanceRef.current && 
        viewerInstanceRef.current.model && 
        (viewerInstanceRef.current.model.getData().urn === urn || 
         viewerInstanceRef.current.model.getData().urn === 'urn:' + urn)) {
        return; 
    }

    setLoading(true);
    setStatus('Autenticando...');

    const getAccessToken = async (callback) => {
        try {
            const response = await fetch('/api/aps/token');
            const data = await response.json();
            callback(data.access_token, data.expires_in);
        } catch (err) { setStatus('Erro Token'); }
    };

    Autodesk.Viewing.Initializer({ env: 'AutodeskProduction', api: 'derivativeV2', getAccessToken }, () => {
      const viewerDiv = viewerContainerRef.current;
      if (!viewerDiv) return;

      let viewer = viewerInstanceRef.current;
      if (!viewer) {
          viewer = new Autodesk.Viewing.GuiViewer3D(viewerDiv);
          viewer.start();
          viewerInstanceRef.current = viewer;
          viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, (e) => {
              if (e.dbIdArray.length) setSelectedId(e.dbIdArray[0]);
              else setSelectedId(null);
          });
      }

      const documentId = urn.startsWith('urn:') ? urn : 'urn:' + urn;
      Autodesk.Viewing.Document.load(documentId, 
        (doc) => {
            const defaultModel = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, defaultModel).then(() => {
                setLoading(false);
                setStatus('Pronto');
                viewer.fitToView();
            });
        },
        (errorCode) => console.error(errorCode)
      );
    });
  }, [urn]);

  return (
    <div className="w-full h-full relative bg-gray-900 flex flex-col">
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/90 text-white">
            <FontAwesomeIcon icon={faSpinner} className="text-4xl text-blue-500 animate-spin mb-4" />
            <p className="text-xs font-mono animate-pulse">{status}</p>
        </div>
      )}
      <div ref={viewerContainerRef} className="w-full h-full relative" />
    </div>
  );
}

// OBRIGATÓRIO: Impede que o React recarregue o componente se o URN for igual
export default React.memo(AutodeskViewerAPI, (prev, next) => prev.urn === next.urn);