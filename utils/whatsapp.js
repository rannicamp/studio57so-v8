/**
 * Função para enviar uma mensagem de template do WhatsApp através da API interna.
 * @param {string} to - O número de telefone do destinatário (ex: 5533999999999).
 * @param {string} templateName - O nome do modelo de mensagem aprovado pela Meta.
 * @param {string} languageCode - O código do idioma (ex: 'pt_BR', 'en_US').
 * @param {Array} [components] - Componentes opcionais para o corpo ou botões do template.
 * @returns {Promise<{success: boolean, error?: string}>} - Retorna um objeto indicando sucesso ou falha.
 */
export async function sendWhatsAppTemplate(to, templateName, languageCode, components = []) {
    try {
        const response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'template', // Indica que é um template
                to,
                templateName,
                languageCode,
                components,
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Erro desconhecido ao enviar o template.');
        }

        return { success: true, data: result };

    } catch (error) {
        console.error('Erro na função sendWhatsAppTemplate:', error);
        return { success: false, error: error.message };
    }
}


/**
 * Função para enviar uma mensagem de texto simples do WhatsApp.
 * @param {string} to - O número de telefone do destinatário.
 * @param {string} text - O conteúdo da mensagem a ser enviada.
 * @returns {Promise<{success: boolean, error?: string}>} - Retorna um objeto indicando sucesso ou falha.
 */
export async function sendWhatsAppText(to, text) {
    try {
        const response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'text', // Indica que é uma mensagem de texto
                to,
                text,
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Erro desconhecido ao enviar a mensagem de texto.');
        }

        return { success: true, data: result };

    } catch (error) {
        console.error('Erro na função sendWhatsAppText:', error);
        return { success: false, error: error.message };
    }
}


/**
 * NOVO: Função para enviar uma mensagem com mídia (imagem, documento, etc.) do WhatsApp.
 * @param {string} to - O número de telefone do destinatário.
 * @param {string} type - O tipo de mídia ('image', 'document', 'video', 'audio').
 * @param {string} link - O link público do arquivo no Supabase Storage.
 * @param {string} [caption] - A legenda para a mídia.
 * @param {string} [filename] - O nome do arquivo (importante para documentos).
 * @returns {Promise<{success: boolean, error?: string}>} - Retorna um objeto indicando sucesso ou falha.
 */
export async function sendWhatsAppMedia(to, type, link, caption, filename) {
    try {
        const response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to,
                type,
                link,
                caption,
                filename
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `Erro desconhecido ao enviar a mídia do tipo ${type}.`);
        }

        return { success: true, data: result };

    } catch (error) {
        console.error(`Erro na função sendWhatsAppMedia para o tipo ${type}:`, error);
        return { success: false, error: error.message };
    }
}