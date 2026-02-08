'use client';

// IMPORTANTE: Importamos do nosso "Porteiro" (PdfClient) em vez do 'react-pdf' direto
import { Document, Page, pdfjs } from './PdfClient';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFilePdf, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

// Estilos
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configuração do Worker com verificação de segurança
if (pdfjs && pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export default function PdfThumbnail({ url, width = 250 }) {
    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 overflow-hidden relative">
            <Document
                file={url}
                loading={
                    <div className="text-blue-500 flex flex-col items-center animate-pulse">
                        <FontAwesomeIcon icon={faSpinner} spin size="lg" />
                        <span className="text-[10px] mt-2 font-medium">Carregando...</span>
                    </div>
                }
                error={
                    <div className="text-red-400 flex flex-col items-center p-2 text-center">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl mb-1" />
                        <span className="text-[10px] leading-tight">Erro ao renderizar</span>
                    </div>
                }
                noData={
                    <div className="text-gray-400 flex flex-col items-center">
                        <FontAwesomeIcon icon={faFilePdf} className="text-3xl" />
                        <span className="text-[10px] mt-1">PDF</span>
                    </div>
                }
                className="flex justify-center items-center h-full w-full"
            >
                <Page 
                    pageNumber={1} 
                    width={width} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false}
                    className="shadow-sm bg-white"
                />
            </Document>
        </div>
    );
}