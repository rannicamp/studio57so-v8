// Caminho: utils/metaCapi.js
import crypto from 'crypto';

const PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_MARKETING_API_TOKEN;

export async function sendMetaEvent(eventName, userData, customData = {}, eventId = null) {
  if (!PIXEL_ID || !ACCESS_TOKEN) return;

  const hash = (data) => {
    if (!data) return undefined;
    return crypto.createHash('sha256').update(String(data).trim().toLowerCase()).digest('hex');
  };

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        user_data: {
          em: userData.email ? [hash(userData.email)] : undefined,
          ph: userData.telefone ? [hash(userData.telefone)] : undefined,
          fn: userData.primeiro_nome ? [hash(userData.primeiro_nome)] : undefined,
          ln: userData.sobrenome ? [hash(userData.sobrenome)] : undefined,
        },
        custom_data: customData,
      },
    ],
  };

  try {
    await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`✅ [Meta CAPI] Evento '${eventName}' enviado com sucesso!`);
  } catch (error) {
    console.error('❌ [Meta CAPI] Erro ao enviar:', error);
  }
}