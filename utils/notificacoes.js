'use server';

import { createClient } from '@/utils/supabase/server';
import { buscarIdsPorPermissao } from '@/utils/permissions.js';
import webPush from 'web-push';

// Configuração VAPID (Push Notifications)
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  try {
    webPush.setVapidDetails(
      'mailto:suporte@studio57.arq.br',
      publicKey,
      privateKey
    );
  } catch (err) {
    console.error("⚠️ Erro config VAPID:", err);
  }
} 

/**
 * 📢 NOTIFICAR GRUPO
 */
export async function notificarGrupo({
  permissao,
  titulo,
  mensagem,
  link = null,
  tipo = 'sistema',
  organizacaoId = null,
  supabaseClient = null // <--- ACEITA CLIENTE EXTERNO
}) {
  try {
    const userIds = await buscarIdsPorPermissao(permissao, organizacaoId);

    if (!userIds.length) return { sucesso: true, count: 0 };

    const promises = userIds.map(id => 
      enviarNotificacao({
        userId: id,
        titulo,
        mensagem,
        link,
        tipo,
        organizacaoId,
        supabaseClient // Repassa o cliente
      })
    );

    await Promise.allSettled(promises);
    return { sucesso: true, count: userIds.length };

  } catch (error) {
    console.error("🚨 Erro no disparo em grupo:", error);
    return { sucesso: false, erro: error.message };
  }
}

/**
 * 📨 CARTEIRO INDIVIDUAL (Com suporte a Webhook)
 */
export async function enviarNotificacao({ 
  userId, 
  titulo, 
  mensagem, 
  link = null, 
  tipo = 'sistema',
  organizacaoId = null,
  canal = 'sistema',
  supabaseClient = null // <--- NOVIDADE: Permite injetar o cliente Admin
}) {
  try {
    // Se veio um cliente (do Webhook), usa ele. Se não, cria o padrão (Sessão do Usuário).
    const supabase = supabaseClient || await createClient();

    // --- ETAPA 1: FILTRO DE PREFERÊNCIAS ---
    // (Opcional: Se for Admin Client, ele lê tudo. Se for RLS, precisa garantir leitura de usuarios)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('preferencias_notificacao')
      .eq('id', userId)
      .single();

    if (usuario?.preferencias_notificacao && usuario.preferencias_notificacao[canal] === false) {
      return { sucesso: false, motivo: 'bloqueado_pelo_usuario' };
    }

    // --- ETAPA 2: SALVAR NO BANCO ---
    const dadosNotificacao = {
      user_id: userId,
      titulo,
      mensagem,
      link,
      lida: false,
      tipo: tipo,
      created_at: new Date().toISOString()
    };
    if (organizacaoId) dadosNotificacao.organizacao_id = organizacaoId;

    const { error } = await supabase.from('notificacoes').insert(dadosNotificacao);
    
    if (error) console.error("❌ Erro DB Notificação:", error.message);

    // --- ETAPA 3: DISPARAR PUSH ---
    if (publicKey && privateKey) {
      // Aqui precisamos garantir que buscamos subscriptions. 
      // Se 'supabase' for Admin, funciona. Se for user, só vê as dele (RLS).
      // Para notificar OUTRO usuário, o supabaseClient PRECISA ser Admin.
      const { data: subscriptions } = await supabase
        .from('notification_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (subscriptions?.length > 0) {
        const payload = JSON.stringify({
          title: titulo,
          body: mensagem,
          url: link || '/',
          icon: '/icons/icon-192x192.png',
          tag: 'studio57-aviso',
          data: { tipo }
        });

        const envios = subscriptions.map(sub => 
          webPush.sendNotification(sub.subscription_data, payload)
            .catch(async (err) => {
              if (err.statusCode === 410 || err.statusCode === 404) {
                // Se falhar o envio, remove a inscrição inválida
                await supabase.from('notification_subscriptions').delete().eq('id', sub.id);
              }
            })
        );
        Promise.allSettled(envios);
      }
    }

    return { sucesso: true };

  } catch (error) {
    console.error("🚨 Erro fatal no Carteiro Individual:", error);
    return { sucesso: false, erro: error.message };
  }
}