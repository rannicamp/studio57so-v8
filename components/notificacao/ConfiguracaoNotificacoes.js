"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMoneyBill, 
  faHardHat, 
  faBullhorn, 
  faCog, 
  faSave, 
  faSpinner, 
  faBell,
  faMobileAlt,
  faExclamationTriangle,
  faCheckCircle
} from '@fortawesome/free-solid-svg-icons';

// Função auxiliar para converter a chave VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function ConfiguracaoNotificacoes({ userId }) {
  const supabase = createClient();
  
  // Estados de Interface (UI)
  // IMPORTANTE: Começamos com loading FALSE para a tela aparecer logo.
  // A verificação técnica acontece "por baixo dos panos".
  const [loadingPrefs, setLoadingPrefs] = useState(true); 
  const [saving, setSaving] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  
  // Estado da Inscrição do Dispositivo
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [supportError, setSupportError] = useState(null);

  // Preferências
  const [prefs, setPrefs] = useState({
    financeiro: true,
    comercial: true,
    operacional: true,
    sistema: true
  });

  // 1. Carrega PREFERÊNCIAS (Banco de Dados) - Rápido
  useEffect(() => {
    async function loadPrefs() {
      if (!userId) return;
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('preferencias_notificacao')
          .eq('id', userId)
          .single();

        if (!error && data?.preferencias_notificacao) {
          setPrefs(prev => ({ ...prev, ...data.preferencias_notificacao }));
        }
      } catch (e) {
        console.error("Erro prefs:", e);
      } finally {
        setLoadingPrefs(false);
      }
    }
    loadPrefs();
  }, [userId]);

  // 2. Verifica SUPORTE DO DISPOSITIVO (Navegador/iPhone) - Em paralelo
  useEffect(() => {
    // Checagem básica de ambiente
    if (typeof window !== 'undefined') {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const standalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsIOS(ios);
      setIsStandalone(standalone);
      setPermission(Notification?.permission || 'default');

      // Se não tiver suporte básico, nem tenta verificar inscrição para não travar
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (ios && !standalone) {
          // iPhone fora do PWA é normal não ter PushManager
        } else {
          setSupportError("Este navegador não suporta notificações push.");
        }
        return;
      }

      // Tenta verificar a inscrição existente
      checkSubscription();
    }
  }, [userId]);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.warn("Erro ao checar inscrição (pode ser normal no primeiro acesso):", e);
    }
  };

  // --- AÇÃO: ATIVAR DISPOSITIVO ---
  const handleSubscribeDevice = async () => {
    if (!userId) return toast.error("Usuário não identificado.");
    
    setDeviceLoading(true);

    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error("Seu dispositivo/navegador não suporta notificações web.");
      }

      // 1. Pedir Permissão
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.error("Permissão negada. Verifique as configurações do navegador.");
        setDeviceLoading(false);
        return;
      }

      // 2. Registrar
      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      
      if (!vapidKey) throw new Error("Chave de notificação não configurada.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      // 3. Salvar no Banco
      const subscriptionJSON = subscription.toJSON();
      const { data: userData } = await supabase.from('usuarios').select('organizacao_id').eq('id', userId).single();

      await supabase
        .from('notification_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subscriptionJSON.endpoint,
          subscription_data: subscriptionJSON,
          organizacao_id: userData?.organizacao_id
        }, { onConflict: 'endpoint' });

      setIsSubscribed(true);
      toast.success("Tudo pronto! Você receberá avisos neste celular.");

      // Teste
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          title: "Configurado! 📱",
          message: "Notificações ativas no iPhone/Android.",
          url: "/perfil"
        })
      });

    } catch (error) {
      console.error("Erro fatal ativação:", error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setDeviceLoading(false);
    }
  };

  // --- AÇÃO: DESATIVAR ---
  const handleUnsubscribeDevice = async () => {
    setDeviceLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await supabase.from('notification_subscriptions').delete().eq('endpoint', subscription.endpoint);
      }
      setIsSubscribed(false);
      toast.info("Notificações desligadas neste aparelho.");
    } catch (error) {
      toast.error("Erro ao desativar.");
    } finally {
      setDeviceLoading(false);
    }
  };

  const handleSavePrefs = async () => {
    setSaving(true);
    try {
      await supabase.from('usuarios').update({ preferencias_notificacao: prefs }).eq('id', userId);
      toast.success("Preferências salvas!");
    } catch (error) {
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key) => setPrefs(prev => ({ ...prev, [key]: !prev[key] }));

  // Se estiver carregando APENAS as prefs do banco, mostra um skeleton simples ou spinner
  if (loadingPrefs) return (
    <div className="p-10 flex justify-center text-gray-400">
        <FontAwesomeIcon icon={faSpinner} spin size="2x" />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* --- SEÇÃO 1: ATIVAÇÃO DO DISPOSITIVO (Onde dava erro no iPhone) --- */}
      <div className={`p-6 rounded-xl border-2 transition-all ${isSubscribed ? 'border-green-100 bg-green-50/50' : 'border-blue-100 bg-blue-50/30'}`}>
        <div className="flex flex-col gap-4">
          
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faMobileAlt} className={isSubscribed ? "text-green-600" : "text-blue-500"} />
                {isSubscribed ? "Dispositivo Conectado" : "Ativar neste Aparelho"}
              </h3>
              <p className="text-sm text-gray-600 mt-1 max-w-lg">
                {isSubscribed 
                  ? "Seu celular está pronto para receber alertas do Studio 57." 
                  : "Receba avisos de vendas e obras mesmo com o aplicativo fechado."}
              </p>
            </div>
            
            {isSubscribed && <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-2xl" />}
          </div>

          {/* Avisos específicos de erro/iOS */}
          {supportError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-100">
              {supportError}
            </div>
          )}

          {isIOS && !isStandalone && (
            <div className="p-3 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-200 flex gap-2">
              <FontAwesomeIcon icon={faExclamationTriangle} className="mt-1" />
              <div>
                <strong>Atenção iPhone:</strong> Para ativar as notificações, você precisa adicionar este site à Tela de Início.
                <br />1. Toque em <strong>Compartilhar</strong> (quadradinho com seta).
                <br />2. Escolha <strong>"Adicionar à Tela de Início"</strong>.
                <br />3. Abra o novo ícone criado.
              </div>
            </div>
          )}

          {/* O Botão Mágico */}
          <div className="pt-2">
            {!isSubscribed ? (
              <button
                onClick={handleSubscribeDevice}
                disabled={deviceLoading || (isIOS && !isStandalone)}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deviceLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faBell} />}
                {deviceLoading ? 'Ativando...' : 'Ativar Notificações Agora'}
              </button>
            ) : (
              <button
                onClick={handleUnsubscribeDevice}
                disabled={deviceLoading}
                className="text-red-600 text-sm hover:underline font-medium flex items-center gap-2"
              >
                {deviceLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : "Desativar notificações neste aparelho"}
              </button>
            )}
          </div>

        </div>
      </div>

      <hr className="border-gray-100" />

      {/* --- SEÇÃO 2: TIPOS DE NOTIFICAÇÃO (Igual ao anterior) --- */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faCog} className="text-gray-400" />
          Preferências de Alerta
        </h3>
        
        <div className="grid gap-3">
            {[
                { key: 'financeiro', label: 'Financeiro', icon: faMoneyBill, color: 'text-green-600', bg: 'bg-green-100', desc: 'Contas, pagamentos e fluxo.' },
                { key: 'comercial', label: 'Comercial', icon: faBullhorn, color: 'text-blue-600', bg: 'bg-blue-100', desc: 'Leads, vendas e metas.' },
                { key: 'operacional', label: 'Operacional', icon: faHardHat, color: 'text-orange-600', bg: 'bg-orange-100', desc: 'Obras, diário e compras.' },
                { key: 'sistema', label: 'Sistema', icon: faCog, color: 'text-gray-600', bg: 'bg-gray-200', desc: 'Segurança e avisos gerais.' },
            ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.bg} ${item.color}`}>
                            <FontAwesomeIcon icon={item.icon} />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800 text-sm">{item.label}</p>
                            <p className="text-xs text-gray-500">{item.desc}</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={prefs[item.key]} onChange={() => toggle(item.key)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSavePrefs}
            disabled={saving}
            className="bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-black transition-colors flex items-center gap-2 font-bold shadow-sm text-sm"
          >
            {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
            {saving ? 'Salvando...' : 'Salvar Preferências'}
          </button>
        </div>
      </div>
    </div>
  );
}