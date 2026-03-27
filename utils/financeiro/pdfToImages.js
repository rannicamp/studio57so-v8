export async function convertPdfToImages(file, scale = 2.0) {
    if (typeof window === 'undefined') {
        throw new Error("A conversão de PDF para imagem deve rodar exclusivamente no client-side (navegador).");
    }

    // Carregamento dinâmico via CDN blindado (evita quebra do Webpack/Next.js no servidor)
    if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    resolve();
                } else {
                    reject(new Error("pdfjsLib não encontrado após onload."));
                }
            };
            script.onerror = () => reject(new Error("Falha ao carregar a biblioteca pdf.js."));
            document.head.appendChild(script);
        });
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const imageFiles = [];
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale });
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            await page.render(renderContext).promise;
            
            // Converte o canvas finalizado para Blob (JPEG) com qualidade de 80%
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            
            // Encapsula o Blob num objeto File nativo
            const imageFile = new File([blob], `page_${pageNum}.jpg`, { type: 'image/jpeg' });
            imageFiles.push(imageFile);
        }
        
        return imageFiles;

    } catch (error) {
        console.error("Erro interno ao fatiar o arquivo PDF localmente:", error);
        throw error;
    }
}
