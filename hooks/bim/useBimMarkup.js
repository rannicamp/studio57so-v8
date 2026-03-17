// Caminho: hooks/bim/useBimMarkup.js
import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export function useBimMarkup(viewerInstance) {
    const [isMarkupActive, setIsMarkupActive] = useState(false);
    const [activeTool, setActiveTool] = useState(null); // 'arrow', 'rectangle', 'circle', 'text', 'freehand'
    const markupExtensionRef = useRef(null);
    const hasLoadedRef = useRef(false);

    // Carregar extensão
    const loadExtension = useCallback(async () => {
        if (!viewerInstance) return false;
        if (hasLoadedRef.current) return true;

        try {
            const ext = await viewerInstance.loadExtension('Autodesk.Viewing.MarkupsCore');
            markupExtensionRef.current = ext;
            hasLoadedRef.current = true;
            return true;
        } catch (error) {
            console.error("Falha ao carregar MarkupsCore", error);
            toast.error("Erro ao inicializar ferramentas de desenho.");
            return false;
        }
    }, [viewerInstance]);

    // Entrar no modo Markup
    const enterMarkupMode = useCallback(async () => {
        const loaded = await loadExtension();
        if (!loaded) return;

        markupExtensionRef.current.enterEditMode();
        setIsMarkupActive(true);
        // Selecionar ferramenta padrão (desenho livre)
        setMarkupTool('freehand');
    }, [loadExtension]);

    // Sair do modo Markup
    const leaveMarkupMode = useCallback(() => {
        if (!markupExtensionRef.current) return;
        
        markupExtensionRef.current.clear(); // <-- PULO DO GATO: Limpa qualquer rastro na tela
        markupExtensionRef.current.leaveEditMode();
        setIsMarkupActive(false);
        setActiveTool(null);
    }, []);

    // Trocar a ferramenta
    const setMarkupTool = useCallback((toolName) => {
        if (!markupExtensionRef.current || !isMarkupActive) return;

        let toolId = null;
        switch (toolName) {
            case 'arrow':
                toolId = new Autodesk.Viewing.Extensions.Markups.Core.EditModeArrow(markupExtensionRef.current);
                break;
            case 'rectangle':
                toolId = new Autodesk.Viewing.Extensions.Markups.Core.EditModeRectangle(markupExtensionRef.current);
                break;
            case 'circle':
                toolId = new Autodesk.Viewing.Extensions.Markups.Core.EditModeCircle(markupExtensionRef.current);
                break;
            case 'text':
                toolId = new Autodesk.Viewing.Extensions.Markups.Core.EditModeText(markupExtensionRef.current);
                break;
            case 'freehand':
            default:
                toolId = new Autodesk.Viewing.Extensions.Markups.Core.EditModeFreehand(markupExtensionRef.current);
                break;
        }

        if (toolId) {
            markupExtensionRef.current.changeEditMode(toolId);
            setActiveTool(toolName);
        }
    }, [isMarkupActive]);

    // Desfazer / Refazer (opcional, se quiser botões)
    const undo = useCallback(() => {
        if (markupExtensionRef.current && isMarkupActive) {
            markupExtensionRef.current.undo();
        }
    }, [isMarkupActive]);

    // Limpar tudo
    const clearMarkups = useCallback(() => {
        if (markupExtensionRef.current && isMarkupActive) {
            markupExtensionRef.current.clear();
        }
    }, [isMarkupActive]);

    // Gerar o SVG final
    const generateMarkupData = useCallback(() => {
        if (!markupExtensionRef.current || !isMarkupActive) return null;
        // Gera a string SVG
        const svgString = markupExtensionRef.current.generateData();
        
        // Pega o estado da câmera nesse exato momento para recarregar perfeito depois
        const cameraState = viewerInstance.getState({ viewport: true });
        
        return {
            svgString: svgString || "",
            cameraState
        };
    }, [isMarkupActive, viewerInstance]);

    // Mostrar anotações salvas (para quando clica num comentário antigo)
    const showSavedMarkup = useCallback(async (svgString) => {
        const loaded = await loadExtension();
        if (!loaded || !svgString) return;

        // Se estiver no modo edição, melhor sair primeiro para não misturar os rabiscos
        if (isMarkupActive) leaveMarkupMode();

        // Carrega o SVG e pinta na tela (o IDLayer é amarrado para gerenciar se tiver múltiplas anotações)
        markupExtensionRef.current.show();
        markupExtensionRef.current.loadMarkups(svgString, "bim_note_layer");
    }, [loadExtension, isMarkupActive, leaveMarkupMode]);

    // Esconder anotações (quando fecha a nota no inspetor)
    const hideMarkups = useCallback(() => {
        if (!markupExtensionRef.current) return;
        markupExtensionRef.current.hide();
    }, []);

    return {
        isMarkupActive,
        activeTool,
        enterMarkupMode,
        leaveMarkupMode,
        setMarkupTool,
        undo,
        clearMarkups,
        generateMarkupData,
        showSavedMarkup,
        hideMarkups
    };
}
