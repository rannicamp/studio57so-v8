// Caminho: components/bim/BimContextMenu.js
'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export default function BimContextMenu({ viewer, onOpenCreate, onOpenLink }) {
  const isConfiguredRef = useRef(false);

  useEffect(() => {
    if (!viewer) return;

    // Função que aplica a customização
    const applyCustomMenu = () => {
      // Evita re-aplicar várias vezes desnecessariamente
      if (isConfiguredRef.current && viewer.customizeContextMenu.isStudio57) return;

      console.log("🛠️ [Elo 57] Aplicando Menu de Contexto...");

      // Salva a referência original
      const originalCustomize = viewer.customizeContextMenu;

      // Sobrescreve
      viewer.customizeContextMenu = function (menu, status) {
        // 1. Chama o original (se existir)
        if (originalCustomize) {
          originalCustomize.call(this, menu, status);
        }

        // 2. Adiciona o nosso
        if (status.dbId) {
          const dbId = status.dbId;
          const model = status.model;

          // Confirmação no console
          console.log("🖱️ [Elo 57] Clique Direito detectado no ID:", dbId);

          if (model) {
            menu.push({ title: '----' });

            // Título Visual
            menu.push({ title: '🚀 Ações Elo 57', target: () => { } });

            // Item: Criar
            menu.push({
              title: '📝 Criar Nova Atividade',
              target: () => {
                model.getBulkProperties([dbId], { propFilter: ['externalId', 'name'] }, (props) => {
                  const item = props[0];
                  if (!item) return;

                  const contextData = {
                    externalId: item.externalId,
                    elementName: item.name || 'Elemento sem nome',
                    projetoBimId: model.studio57_context?.id,
                    urn: model.studio57_context?.urn_autodesk
                  };

                  if (!contextData.projetoBimId) {
                    toast.error("⚠️ Modelo sem contexto. Tente recarregar.");
                    return;
                  }
                  onOpenCreate(contextData);
                });
              }
            });

            // Item: Vincular
            menu.push({
              title: '🔗 Vincular Atividade',
              target: () => {
                model.getBulkProperties([dbId], { propFilter: ['externalId', 'name'] }, (props) => {
                  const item = props[0];
                  if (!item) return;

                  const contextData = {
                    externalId: item.externalId,
                    elementName: item.name || 'Elemento sem nome',
                    projetoBimId: model.studio57_context?.id,
                    urn: model.studio57_context?.urn_autodesk
                  };

                  if (!contextData.projetoBimId) {
                    toast.error("⚠️ Modelo sem contexto.");
                    return;
                  }
                  onOpenLink(contextData);
                });
              }
            });
          }
        }
      };

      // Marca como configurado para evitar loops, mas permite reconfigurar se o viewer mudar
      viewer.customizeContextMenu.isStudio57 = true;
      isConfiguredRef.current = true;
      console.log("✅ [Elo 57] Menu de Contexto Configurado com Sucesso.");
    };

    // --- ESTRATÉGIA DE INJEÇÃO ---

    // 1. Tenta aplicar imediatamente (caso já esteja carregado)
    applyCustomMenu();

    // 2. Escuta o evento de Toolbar (garantia de carregamento da UI)
    const onToolbarCreated = () => {
      applyCustomMenu();
    };

    // Adiciona listener
    if (window.Autodesk && window.Autodesk.Viewing) {
      viewer.addEventListener(window.Autodesk.Viewing.TOOLBAR_CREATED_EVENT, onToolbarCreated);
      // Também escuta quando o modelo termina de carregar, pois às vezes o menu reseta
      viewer.addEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onToolbarCreated);
    }

    return () => {
      if (viewer && window.Autodesk && window.Autodesk.Viewing) {
        viewer.removeEventListener(window.Autodesk.Viewing.TOOLBAR_CREATED_EVENT, onToolbarCreated);
        viewer.removeEventListener(window.Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onToolbarCreated);
      }
      isConfiguredRef.current = false;
    };

  }, [viewer, onOpenCreate, onOpenLink]);

  return null;
}