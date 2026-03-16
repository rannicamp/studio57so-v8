import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPen, faArrowRight, faFont, faSquare, faCircle, 
    faUndo, faTrash, faSave, faTimes, faArrowsAlt
} from '@fortawesome/free-solid-svg-icons';

export default function BimMarkupToolbar({ 
    activeTool, 
    setMarkupTool, 
    onUndo, 
    onClear, 
    onSave, 
    onCancel 
}) {
    return (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[70] bg-white rounded-xl shadow-xl border border-gray-200 p-2 flex items-center gap-1 animate-fadeIn">
            
            {/* Ferramenta de Mover Câmera (Sair do modo desenho temporariamente) */}
            {/* Nota: No MarkupsCore padrão, não se move a câmera. Ele trava. Mas podemos adicionar um botão ilustrativo de 'travado' */}
            
            <div className="flex bg-gray-100 rounded-lg p-1 mr-2">
                <button 
                    onClick={() => setMarkupTool('freehand')}
                    className={`p-2 w-10 h-10 rounded-md flex items-center justify-center transition-colors ${activeTool === 'freehand' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-blue-600'}`}
                    title="Desenho Livre"
                >
                    <FontAwesomeIcon icon={faPen} />
                </button>
                <button 
                    onClick={() => setMarkupTool('arrow')}
                    className={`p-2 w-10 h-10 rounded-md flex items-center justify-center transition-colors ${activeTool === 'arrow' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-blue-600'}`}
                    title="Seta"
                >
                    <FontAwesomeIcon icon={faArrowRight} />
                </button>
                <button 
                    onClick={() => setMarkupTool('rectangle')}
                    className={`p-2 w-10 h-10 rounded-md flex items-center justify-center transition-colors ${activeTool === 'rectangle' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-blue-600'}`}
                    title="Retângulo"
                >
                    <FontAwesomeIcon icon={faSquare} className="text-sm" />
                </button>
                <button 
                    onClick={() => setMarkupTool('circle')}
                    className={`p-2 w-10 h-10 rounded-md flex items-center justify-center transition-colors ${activeTool === 'circle' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-blue-600'}`}
                    title="Círculo"
                >
                    <FontAwesomeIcon icon={faCircle} className="text-sm" />
                </button>
                <button 
                    onClick={() => setMarkupTool('text')}
                    className={`p-2 w-10 h-10 rounded-md flex items-center justify-center transition-colors ${activeTool === 'text' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-blue-600'}`}
                    title="Texto"
                >
                    <FontAwesomeIcon icon={faFont} />
                </button>
            </div>

            <div className="h-6 w-px bg-gray-300 mx-1"></div>

            <button 
                onClick={onUndo}
                className="p-2 w-10 h-10 rounded-md text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
                title="Desfazer"
            >
                <FontAwesomeIcon icon={faUndo} />
            </button>
            <button 
                onClick={onClear}
                className="p-2 w-10 h-10 rounded-md text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                title="Limpar Tudo"
            >
                <FontAwesomeIcon icon={faTrash} />
            </button>

            <div className="h-6 w-px bg-gray-300 mx-1"></div>

            <button 
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
                <FontAwesomeIcon icon={faTimes} /> Cancelar
            </button>
            <button 
                onClick={onSave}
                className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow transition-colors flex items-center gap-2"
            >
                <FontAwesomeIcon icon={faSave} /> Concluir Nota
            </button>
        </div>
    );
}
