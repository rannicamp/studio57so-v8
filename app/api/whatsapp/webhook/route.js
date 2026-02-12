// app/api/whatsapp/webhook/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// IMPORTANTE: Importando os serviços novos
import { logWebhook } from './services/helpers';
import { findOrCreateContactAndConversation } from './services/crm';
import { handleMessageInsert, handleReaction } from './services/message';

// Configuração do Supabase Admin
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// --- ROTA GET (Verificação do Token) ---
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('hub.mode') === 'subscribe' && 
        searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(searchParams.get('hub.challenge'), { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
}

// --- ROTA POST (O Coração do Webhook) ---
export async function POST(request) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        const body = await request.json();
        
        // 1. Validar Configuração
        const { data: config } = await supabaseAdmin.from('configuracoes_whatsapp').select('*').single();
        if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 500 });

        const change = body.entry?.[0]?.changes?.[0]?.value;
        if (!change) return NextResponse.json({ status: 'ignored_empty' });

        // 2. Rota de Status (Enviado, Entregue, Lido...)
        if (change.statuses) {
            const statusUpdate = change.statuses[0];
            await supabaseAdmin.from('whatsapp_messages')
                .update({ status: statusUpdate.status })
                .eq('message_id', statusUpdate.id);
            return NextResponse.json({ status: 'status_updated' });
        }

        // 3. Rota de Mensagens e Reações
        const message = change.messages?.[0];
        if (message) {
            console.log(`[Webhook] Recebido tipo: ${message.type}`); // LOG PARA DEBUG

            // >>> AQUI ESTÁ A MÁGICA: SE FOR REAÇÃO, PARA TUDO E ATUALIZA <<<
            if (message.type === 'reaction') {
                await handleReaction(supabaseAdmin, message.reaction, message.from);
                return NextResponse.json({ status: 'reaction_processed' });
            }

            // Se chegou aqui, é mensagem normal (texto, imagem, audio)
            
            // A. Garante que contato e conversa existem
            const { contatoId, conversationRecordId } = await findOrCreateContactAndConversation(supabaseAdmin, message, config);
            
            // B. Verifica duplicidade
            const { data: existing } = await supabaseAdmin.from('whatsapp_messages').select('id').eq('message_id', message.id).maybeSingle();
            if (existing) return NextResponse.json({ status: 'ignored_duplicate' });

            // C. Insere a mensagem
            await handleMessageInsert(supabaseAdmin, message, config, contatoId, conversationRecordId);
            
            await logWebhook(supabaseAdmin, 'INFO', `Msg recebida: ${message.type}`, { from: message.from });
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook] Erro Fatal:', error);
        // Tenta logar o erro, se possível
        try { await logWebhook(supabaseAdmin, 'FATAL', 'Crash no Webhook', { error: error.message }); } catch(e) {}
        
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}