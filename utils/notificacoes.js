'use server';

import { createClient } from '@/utils/supabase/server';
import webPush from 'web-push';

// Configura as chaves de segurança para falar com o Google/Android
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webPush.setVapidDetails(
    'mailto:suporte@studio57.arq.br',
    publicKey,
    privateKey
  );
} else {
  console.warn("⚠️ AVISO: Chaves VAPID não encontradas. O Push para celular não funcionará.");
}

/**
 * 📨 CARTEIRO MASTER DO STUDIO 57
 * 1. Verifica preferências do usuário.
 * 2. Salva no banco (Sininho).
 * 3. Dispara vibração no celular (Push).
 */
export async function enviarNotificacao({ 
  userId, 
  titulo, 
  mensagem, 
  link = null, 
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

    // Se o usuário desligou esse canal, paramos aqui
    if (usuario?.preferencias_notificacao && usuario.preferencias_notificacao[canal] === false) {
      console.log(`🔕 Notificação bloqueada pelo usuário (Canal: ${canal})`);
      return { sucesso: false, motivo: 'bloqueado_pelo_usuario' };
    }

    // --- ETAPA 2: SALVAR NO BANCO (SININHO) ---
    const dadosNotificacao = {
      user_id: userId,
      titulo,
      mensagem,
      link,
      lida: false,
      created_at: new Date().toISOString()
    };
    if (organizacaoId) dadosNotificacao.organizacao_id = organizacaoId;

    const { error } = await supabase.from('notificacoes').insert(dadosNotificacao);
    
    if (error) {
      console.error("❌ Erro ao salvar notificação interna:", error.message);
      // Mesmo com erro no banco, tentamos o push se possível
    } else {
        console.log("✅ Notificação interna salva com sucesso.");
    }

    // --- ETAPA 3: DISPARAR PARA O ANDROID (PUSH) ---
    if (publicKey && privateKey) {
      // Busca todos os celulares/PCs registrados desse usuário
      const { data: subscriptions } = await supabase
        .from('notification_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (subscriptions && subscriptions.length > 0) {
        console.log(`📲 Disparando Push para ${subscriptions.length} dispositivo(s)...`);

        const payload = JSON.stringify({
          title: titulo,
          body: mensagem, // O Android mostra isso no banner
          message: mensagem, 
          url: link || '/',
          icon: '/icons/icon-192x192.png',
          tag: 'studio57-aviso' // Agrupa notificações para não encher a tela
        });

        // Envia para todos em paralelo
        const envios = subscriptions.map(sub => 
          webPush.sendNotification(sub.subscription_data, payload)
            .catch(async (err) => {
              // Se der erro 410 (Gone) ou 404, o registro é velho. Vamos limpar.
              if (err.statusCode === 410 || err.statusCode === 404) {
                console.log(`🗑️ Limpando inscrição inválida: ${sub.id}`);
                await supabase.from('notification_subscriptions').delete().eq('id', sub.id);
              } else {
                console.error(`❌ Erro no envio Push (ID ${sub.id}):`, err.statusCode);
              }
            })
        );

        // Não travamos o código esperando o envio (Fire and Forget)
        Promise.allSettled(envios);
      } else {
        console.log("ℹ️ Usuário não tem dispositivos registrados para Push.");
      }
    }

    return { sucesso: true };

  } catch (error) {
    console.error("🚨 Erro fatal no Carteiro:", error);
    return { sucesso: false, erro: error.message };
  }
}