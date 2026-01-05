import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO SIMPLES ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    }
);

// --- 1. VERIFICAÇÃO (GET) ---
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse('Proibido', { status: 403 });
}

// --- 2. RECEBIMENTO (POST) ---
export async function POST(request) {
    const supabaseAdmin = getSupabaseAdmin();
    
    try {
        const body = await request.json();
        
        // Verifica se é uma notificação do WhatsApp
        if (!body.object || !body.entry) {
            return NextResponse.json({ status: 'ignored' });
        }

        const value = body.entry[0]?.changes[0]?.value;
        
        // Se for mensagem recebida
        if (value?.messages && value?.messages[0]) {
            const message = value.messages[0];
            const contactName = value.contacts?.[0]?.profile?.name || 'Desconhecido';
            
            console.log('📨 Recebendo mensagem de:', message.from);

            // Monta o objeto BÁSICO. O Trigger do banco fará o resto (vincular contato/conversa).
            const payload = {
                message_id: message.id,
                sender_id: message.from,     // Quem mandou
                receiver_id: value.metadata?.phone_number_id, // Quem recebeu (Sua empresa)
                content: extractContent(message), // Texto ou descrição da mídia
                sent_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                direction: 'inbound',
                status: 'delivered',
                raw_payload: message, // Guarda o JSON original por segurança
                organizacao_id: 2, // FORÇANDO ID 2 (STUDIO 57) PARA GARANTIR VISIBILIDADE
                nome_remetente: contactName // Opcional, ajuda se o trigger falhar
            };

            // Insere no banco
            const { error } = await supabaseAdmin
                .from('whatsapp_messages')
                .insert(payload);

            if (error) {
                console.error('❌ Erro ao salvar no banco:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            console.log('✅ Mensagem salva! O Trigger do banco vai processar o resto.');
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('💥 Erro fatal no Webhook:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

// Função auxiliar simples para extrair texto
function extractContent(msg) {
    if (msg.type === 'text') return msg.text.body;
    if (msg.type === 'button') return msg.button.text;
    if (msg.type === 'interactive') {
        return msg.interactive.button_reply?.title || msg.interactive.list_reply?.title || 'Interação';
    }
    // Mídias
    if (msg.type === 'image') return '📷 Imagem Recebida';
    if (msg.type === 'audio' || msg.type === 'voice') return '🎤 Áudio Recebido';
    if (msg.type === 'document') return '📄 Documento Recebido';
    if (msg.type === 'video') return '🎥 Vídeo Recebido';
    if (msg.type === 'sticker') return '👾 Figurinha';
    return `[${msg.type.toUpperCase()}]`;
}