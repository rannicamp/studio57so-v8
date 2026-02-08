'use client';

// 1. A VACINA: Mantemos ela para garantir compatibilidade total
import './pdfPolyfill';

// 2. Importamos a biblioteca React-PDF
import { Document, Page, pdfjs } from 'react-pdf';

// 3. Configuração do Worker (O Operário)
// IMPORTANTE: Para a versão 9.1.1 do react-pdf, usamos o pdfjs-dist versão 4.4.168
// Fixamos a versão aqui para evitar que ele tente baixar uma versão incompatível
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

// 4. Re-exportamos tudo para o resto do sistema usar
export { Document, Page, pdfjs };