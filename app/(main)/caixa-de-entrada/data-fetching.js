import { createClient } from '@/utils/supabase/client';

export const getConversations = async (supabase, organizacaoId, userId) => {
 if (!organizacaoId || !userId) return [];

 try {
 // --- QUERY HÍBRIDA ---
 const { data, error } = await supabase
 .from('whatsapp_conversations')
 .select(`
 *,
 contatos (
 id,
 nome,
 foto_url,
 tipo_contato,
 telefone_principal: telefones (telefone),
 funil: contatos_no_funil!contato_id (
 coluna: colunas_funil (
 nome
 )
 )
 ),
 last_message: whatsapp_messages!last_message_id (
 content,
 created_at,
 status
 ),
 recent_msgs: whatsapp_messages!whatsapp_messages_conversation_record_id_fkey (
 sent_at,
 direction
 )
 `)
 .eq('organizacao_id', organizacaoId)
 // Ordenamos as mensagens recentes para garantir que achamos a última recebida do cliente
 .order('sent_at', { foreignTable: 'recent_msgs', ascending: false })
 .limit(10, { foreignTable: 'recent_msgs' })
 .order('updated_at', { ascending: false });

 if (error) {
 console.error('Erro ao buscar conversas:', error);
 return [];
 }

 return data.map(conv => {
 // --- 1. LÓGICA DO FUNIL ---
 let nomeEtapa = null;
 const dadosFunil = conv.contatos?.funil;

 if (Array.isArray(dadosFunil) && dadosFunil.length > 0) {
 nomeEtapa = dadosFunil[0]?.coluna?.nome;
 } else if (dadosFunil && typeof dadosFunil === 'object') {
 nomeEtapa = dadosFunil?.coluna?.nome;
 }

 // --- 2. LÓGICA DO CRONÔMETRO ---
 const lastInboundMsg = conv.recent_msgs?.find(m => m.direction === 'inbound');
 const lastInboundAt = conv.customer_window_start_at || (lastInboundMsg ? lastInboundMsg.sent_at : null);

 return {
 conversation_id: conv.id,
 contato_id: conv.contatos?.id,
 phone_number: conv.phone_number,
 nome: conv.contatos?.nome || conv.phone_number,
 avatar_url: conv.contatos?.foto_url,
 // AQUI ACONTECE A MÁGICA COLABORATIVA: Busca o count apenas deste usuário, ou 0 se nulo
 unread_count: conv.user_unread_counts?.[userId] || 0,
 last_message_content: conv.last_message?.content,
 // Status da última mensagem para saber se falhou
 last_message_status: conv.last_message?.status,
 last_message_at: conv.last_message?.created_at || conv.updated_at,
 is_archived: conv.is_archived || false,
 // Dados Restaurados
 tipo_contato: conv.contatos?.tipo_contato,
 etapa_funil: nomeEtapa,
 // Cronômetro de Janela (fonte confiável: campo exclusivo de mensagens inbound)
 last_inbound_at: lastInboundAt
 };
 });

 } catch (err) {
 console.error("Erro fatal (try/catch) em getConversations:", err);
 return [];
 }
};

// --- FUNÇÃO: BUSCAR LISTAS DE TRANSMISSÃO ---
export const getBroadcastLists = async (supabase, organizacaoId) => {
 if (!organizacaoId) return [];

 const { data, error } = await supabase
 .from('whatsapp_broadcast_lists')
 .select(`
 *,
 membros:whatsapp_list_members(count)
 `)
 .eq('organizacao_id', organizacaoId)
 .order('created_at', { ascending: false });

 if (error) {
 console.error('Erro ao buscar listas:', error);
 return [];
 }

 return data.map(lista => ({
 ...lista,
 membros_count: lista.membros?.[0]?.count || 0
 }));
};

// --- FUNÇÃO: BUSCAR MENSAGENS DO CHAT ---
export const getMessages = async (supabase, organizacaoId, contatoId) => {
 if (!organizacaoId || !contatoId) return [];

 const { data, error } = await supabase
 .from('whatsapp_messages')
 .select('*') // ISSO É VITAL: Traz raw_payload e tudo mais
 .eq('organizacao_id', organizacaoId)
 .eq('contato_id', contatoId)
 .order('sent_at', { ascending: true });

  if (error) {
  console.error('Erro ao buscar mensagens:', error?.message || error, JSON.stringify(error, Object.getOwnPropertyNames(error)));
  return [];
  }

 return data;
};

// --- FUNÇÃO: MARCAR COMO LIDA ---
export const markMessagesAsRead = async (supabase, organizacaoId, contatoId, conversationId, userId) => {
 if (!organizacaoId || !contatoId || !conversationId || !userId) return;

 // 1. Zera a bolinha INVIDIDUAL via RPC
 const { error: rpcError } = await supabase.rpc('reset_whatsapp_unreads', {
   v_conversation_id: conversationId,
   v_user_id: userId
 });
 if (rpcError) console.error('Erro no reset_whatsapp_unreads:', rpcError);

 // 2. Opcional: mantém o is_read true globalmente na mensagem pro "visto" azul do cliente (WhatsApp behaviour)
 await supabase
 .from('whatsapp_messages')
 .update({ is_read: true })
 .eq('organizacao_id', organizacaoId)
 .eq('contato_id', contatoId)
 .eq('is_read', false);
};

// --- FUNÇÃO NOVA: VERIFICAR SE O WHATSAPP ESTÁ CONFIGURADO (GATEKEEPER) ---
export const getWhatsappConfig = async (supabase, organizacaoId) => {
 if (!organizacaoId) return null;

 const { data, error } = await supabase
 .from('configuracoes_whatsapp')
 .select('*')
 .eq('organizacao_id', organizacaoId)
 .single();

 // Se o erro for "Nenhuma linha encontrada" (PGRST116), nós apenas retornamos null (não tem config)
 if (error && error.code !== 'PGRST116') {
 console.error('Erro ao buscar configuração do WhatsApp:', error);
 return null;
 }

 return data;
};