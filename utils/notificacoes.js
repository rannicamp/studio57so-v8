'use server';

import { createClient } from '@/utils/supabase/server';
import { buscarIdsPorPermissao } from '@/utils/permissions.js';
import webPush from 'web-push';

// Configuração VAPID (Push Notifications)
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webPush.setVapidDetails(
    'mailto:suporte@studio57.arq.br',
    publicKey,
    privateKey
  );
} else {
  console.warn("⚠️ AVISO: Chaves VAPID ausentes. Push mobile desativado.");
}

/**
 * 📢 NOTIFICAR GRUPO (Disparo em Massa Inteligente)
 * Envia notificação para todos os usuários que têm uma certa permissão.
 * Ex: notificarGrupo({ permissao: 'financeiro', titulo: 'Nova Fatura', ... })
 */
export async function notificarGrupo({
  permissao,      // Ex: 'financeiro', 'obras' (Chave da permissão)
  titulo,
  mensagem,
  link = null,
  tipo = 'sistema', // 'financeiro', 'obras', 'alerta', 'sucesso'
  organizacaoId = null
}) {
  try {
    console.log(`📢 Iniciando disparo em massa para permissão: [${permissao}]`);

    // 1. Descobre quem são os destinatários
    const userIds = await buscarIdsPorPermissao(permissao, organizacaoId);

    if (!userIds.length) {
      console.log("⚠️ Ninguém encontrado para receber esta notificação.");
      return { sucesso: true, count: 0 };
    }

    console.log(`🎯 Alvos encontrados: ${userIds.length} usuários.`);

    // 2. Dispara para cada um (em paralelo para ser rápido)
    const promises = userIds.map(id => 
      enviarNotificacao({
        userId: id,
        titulo,
        mensagem,
        link,
        tipo, // Passamos o novo campo 'tipo'
        organizacaoId
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
 * 📨 CARTEIRO INDIVIDUAL (Envio Um-a-Um)
 */
export async function enviarNotificacao({ 
  userId, 
  titulo, 
  mensagem, 
  link = null, 
  tipo = 'sistema',
  organizacaoId = null,
  canal = 'sistema' 
}) {
  try {
    const supabase = await createClient();

    // --- ETAPA 1: FILTRO DE PREFERÊNCIAS ---
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('preferencias_notificacao')
      .eq('id', userId)
      .single();

    if (usuario?.preferencias_notificacao && usuario.preferencias_notificacao[canal] === false) {
      return { sucesso: false, motivo: 'bloqueado_pelo_usuario' };
    }

    // --- ETAPA 2: SALVAR NO BANCO (SININHO) ---
    const dadosNotificacao = {
      user_id: userId,
      titulo,
      mensagem,
      link,
      lida: false,
      tipo: tipo, // Salvando o tipo visual
      created_at: new Date().toISOString()
    };
    if (organizacaoId) dadosNotificacao.organizacao_id = organizacaoId;

    const { error } = await supabase.from('notificacoes').insert(dadosNotificacao);
    
    if (error) console.error("❌ Erro DB Notificação:", error.message);

    // --- ETAPA 3: DISPARAR PUSH (ANDROID/PC) ---
    if (publicKey && privateKey) {
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
          data: { tipo } // Passa metadata para o Service Worker se precisar
        });

        const envios = subscriptions.map(sub => 
          webPush.sendNotification(sub.subscription_data, payload)
            .catch(async (err) => {
              if (err.statusCode === 410 || err.statusCode === 404) {
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