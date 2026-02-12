// app/api/whatsapp/webhook/services/helpers.js

// Função para logar no banco (Caixa Preta)
export async function logWebhook(supabaseAdmin, level, message, payload) {
    try {
        await supabaseAdmin.from('whatsapp_webhook_logs').insert({
            log_level: level,
            message: message,
            payload: payload ? payload : null
        });
    } catch (e) {
        console.error('Falha ao gravar log no banco:', e);
    }
}

// Função para extrair texto legível de qualquer tipo de mensagem
export function getTextContent(message) {
    if (!message || !message.type) return null;

    const type = message.type;

    // 1. Texto Simples
    if (type === 'text') return message.text?.body;

    // 2. Interativos (Botões e Listas)
    if (type === 'interactive') {
        const interactive = message.interactive;
        if (interactive.type === 'button_reply') return `[Botão]: ${interactive.button_reply.title}`;
        if (interactive.type === 'list_reply') return `[Lista]: ${interactive.list_reply.title}`;
        return '[Interação]';
    }

    // 3. Botões Legados
    if (type === 'button') return `[Botão]: ${message.button?.text}`;

    // 4. Mídias
    if (type === 'image') return message.image?.caption || '📷 Imagem';
    if (type === 'video') return message.video?.caption || '🎥 Vídeo';
    if (type === 'document') return message.document?.caption || `📄 ${message.document?.filename || 'Documento'}`;
    if (type === 'audio') return '🎧 Áudio';
    if (type === 'voice') return '🎤 Voz';
    if (type === 'sticker') return '👾 Figurinha';

    // 5. Outros
    if (type === 'location') return `📍 Localização: ${message.location?.name || 'Ver mapa'}`;
    if (type === 'contacts') return `👤 Contato: ${message.contacts?.[0]?.name?.formatted_name || 'Compartilhado'}`;
    if (type === 'reaction') return `Reaction: ${message.reaction?.emoji}`;
    if (type === 'order') return '🛒 Pedido do Catálogo';
    if (type === 'system') return `⚠️ Sistema: ${message.system?.body || 'Atualização'}`;

    return `[Tipo: ${type}]`; 
}