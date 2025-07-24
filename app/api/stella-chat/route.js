// app/api/stella-chat/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; // Importar o cliente Supabase do servidor
import { processStellaChatMessage } from '@/utils/stella-ai'; // Importar a função de IA

export async function POST(request) {
  const supabase = createClient(); // Inicializar o cliente Supabase
  const { userId, message } = await request.json();

  if (!userId || !message) {
    return NextResponse.json({ error: 'User ID and message are required.' }, { status: 400 });
  }

  let conversationId;

  try {
    // 1. Encontrar ou criar uma conversa
    let { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (convError && convError.code === 'PGRST116') { // No rows found
      const { data: newConv, error: createConvError } = await supabase
        .from('chat_conversations')
        .insert({ user_id: userId })
        .select('id')
        .single();

      if (createConvError) {
        console.error('Error creating new conversation:', createConvError);
        return NextResponse.json({ error: 'Failed to create conversation.' }, { status: 500 });
      }
      conversationId = newConv.id;
    } else if (convError) {
      console.error('Error fetching conversation:', convError);
      return NextResponse.json({ error: 'Failed to retrieve conversation.' }, { status: 500 });
    } else {
      conversationId = conversation.id;
    }

    // 2. Salvar a mensagem do usuário no banco de dados
    const { error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({ conversation_id: conversationId, sender_type: 'user', message_content: message });

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
      // Continuar mesmo se falhar, pois o mais importante é a resposta da IA
    }

    // 3. Obter o histórico recente da conversa para contexto da IA
    const { data: history, error: historyError } = await supabase
      .from('chat_messages')
      .select('sender_type, message_content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10); // Limitar o histórico para manter o contexto relevante

    if (historyError) {
      console.error('Error fetching chat history for AI context:', historyError);
      // Continuar, mas a IA pode ter menos contexto
    }

    // 4. Chamar a função da IA para processar a mensagem
    const aiResponseContent = await processStellaChatMessage(supabase, message, history || []);

    // 5. Salvar a resposta da IA no banco de dados
    const { error: aiMessageError } = await supabase
      .from('chat_messages')
      .insert({ conversation_id: conversationId, sender_type: 'ai', message_content: aiResponseContent });

    if (aiMessageError) {
      console.error('Error saving AI message:', aiMessageError);
      // Continuar mesmo se falhar
    }

    return NextResponse.json({ analysis: aiResponseContent });

  } catch (error) {
    console.error('Error in Stella chat API:', error);
    return NextResponse.json({ error: `Ocorreu um erro interno: ${error.message}` }, { status: 500 });
  }
}