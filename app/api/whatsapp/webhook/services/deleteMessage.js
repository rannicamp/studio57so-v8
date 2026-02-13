import { createClient } from '@/utils/supabase/server';

export const deleteMessageService = async ({ messageId, organizacaoId }) => {
    const supabase = await createClient();

    console.log(`[Delete Service] Apagando mensagem internamente: ${messageId}`);

    // NOTA DO DEVONILDO: 
    // A API da Meta bloqueou o "Delete for Everyone" com o erro (#100).
    // Por enquanto, removemos a chamada externa e fazemos apenas a limpeza
    // no nosso banco de dados para organizar o painel.

    // Atualiza Banco Local (Transforma em mensagem apagada)
    const { error: updateError } = await supabase
        .from('whatsapp_messages')
        .update({ 
            status: 'deleted',
            content: '🚫 Esta mensagem foi apagada',
            media_url: null,
            raw_payload: null
        })
        .eq('message_id', messageId)
        // Garante que só apaga se pertencer à organização certa
        .eq('organizacao_id', organizacaoId);

    if (updateError) {
        console.error('[Delete Service] Erro Banco:', updateError);
        throw new Error('Erro ao atualizar banco: ' + updateError.message);
    }

    return { success: true };
};