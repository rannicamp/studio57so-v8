import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configuração manual do cliente (mantendo seu padrão atual)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
    // 1. Validação das Chaves de API
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração do servidor incompleta (Faltam chaves)." }, { status: 500 });
    }

    try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();
        
        // CORREÇÃO CRÍTICA AQUI:
        // O frontend envia 'organizacaoId', então precisamos ler exatamente esse nome.
        // Adicionei um fallback para garantir que funcione mesmo se mandar com underline.
        const contact_id = body.contact_id;
        const organizacaoId = body.organizacaoId || body.organizacao_id;

        // 2. Validação dos Dados Recebidos
        if (!contact_id || !organizacaoId) {
            console.error('[Mark Read API] Dados faltantes:', { contact_id, organizacaoId });
            return NextResponse.json({ error: 'ID do contato e Organização são obrigatórios' }, { status: 400 });
        }

        // 3. Marca mensagens como lidas
        await supabaseAdmin
            .from('whatsapp_messages')
            .update({ is_read: true })
            .match({ 
                contato_id: contact_id, 
                direction: 'inbound',
                is_read: false 
            });

        // 4. ZERA o contador na tabela de conversas
        // Agora usamos a variável 'organizacaoId' que garantimos que existe ali em cima (passo 2)
        const { error } = await supabaseAdmin
            .from('whatsapp_conversations')
            .update({ unread_count: 0 })
            .eq('contato_id', contact_id)
            .eq('organizacao_id', organizacaoId);

        if (error) {
            console.error('[Mark Read API] Erro ao atualizar conversa:', error);
            throw error;
        }

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error('[Mark Read API] Erro fatal:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}