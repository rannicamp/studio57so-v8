import { NextResponse } from 'next/server';
// Importando o novo arquivo com nome específico
import { deleteMessageService } from '@/app/api/whatsapp/webhook/services/deleteMessage';

export async function POST(req) {
    try {
        const { messageId, organizacaoId } = await req.json();

        // Não precisamos mais checar "action", a rota JÁ É delete
        if (!messageId || !organizacaoId) {
            return NextResponse.json({ error: 'ID da mensagem ou organização faltando' }, { status: 400 });
        }

        const result = await deleteMessageService({ messageId, organizacaoId });
        
        return NextResponse.json(result);

    } catch (error) {
        console.error('[Delete Route] Erro:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}