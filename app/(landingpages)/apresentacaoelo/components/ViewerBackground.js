'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

const AUTH_URL = '/api/aps/token'; 

export default function ViewerBackground({ urn }) {
  const viewerDivRef = useRef(null);
  const viewerRef = useRef(null);
  const [token, setToken] = useState(null);

  // 1. Busca Token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(AUTH_URL);
        if (!response.ok) throw new Error('Falha no token');
        const data = await response.json();
        setToken(data.access_token);
      } catch (error) {
        console.error('Erro APS Token:', error);
      }
    };
    fetchToken();
  }, []);

  // 2. Inicializa o Viewer Interativo (Orbita + Zoom)
  useEffect(() => {
    if (token && window.Autodesk && urn && !viewerRef.current) {
      const options = {
        env: 'AutodeskProduction2',
        api: 'streamingV2',
        accessToken: token,
      };

      Autodesk.Viewing.Initializer(options, () => {
        // Viewer3D mantém a navegação pura sem a barra de ferramentas (UI)
        const viewer = new Autodesk.Viewing.Viewer3D(viewerDivRef.current);
        
        const started = viewer.start();
        if (started > 0) {
          console.error('Erro ao iniciar viewer:', started);
          return;
        }

        viewerRef.current = viewer;

        // --- CONFIGURAÇÕES VISUAIS E DE INTERAÇÃO ---
        
        // Tema Limpo
        viewer.setTheme('light-theme');
        viewer.setQualityLevel(false, false); 
        viewer.setGhosting(false);

        // Carrega o Modelo
        const documentId = urn.startsWith('urn:') ? urn : 'urn:' + urn;
        
        Autodesk.Viewing.Document.load(documentId, (doc) => {
          const defaultModel = doc.getRoot().getDefaultGeometry();
          
          viewer.loadDocumentNode(doc, defaultModel).then(() => {
            // Fundo Branco
            viewer.setBackgroundColor(255, 255, 255, 255, 255, 255);
            
            // ATENÇÃO: Habilitamos a interação aqui!
            // Removemos o bloqueio de 'pointerEvents'
            
            // TRUQUE: Desabilita o clique de seleção (não fica azul)
            // O mouse serve SÓ para navegar (Órbita e Zoom)
            viewer.setCanvasClickBehavior(Autodesk.Viewing.CanvasClickBehavior.DISABLE_ALL);
            
            // Ajusta a câmera inicial
            viewer.fitToView();
          });
        });
      });
    }
  }, [token, urn]);

  return (
    <div className="relative w-full h-full bg-gray-50">
      <Script 
        src="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js" 
        strategy="lazyOnload"
      />
      <link rel="stylesheet" href="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css" type="text/css" />
      
      {/* Removi 'pointer-events-none' daqui.
          Agora o cursor do mouse interage com o canvas (canvas recebe eventos).
      */}
      <div ref={viewerDivRef} className="absolute inset-0 w-full h-full z-0 cursor-move" title="Clique e arraste para girar" />
    </div>
  );
}