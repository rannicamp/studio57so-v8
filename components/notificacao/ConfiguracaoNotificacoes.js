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
  faBellSlash,
  faMobileAlt,
  faCheckCircle,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

// Função auxiliar para converter a chave VAPID (Necessária para navegador entender a criptografia)
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  
  // Estado da Inscrição do Dispositivo (Navegador atual)
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Preferências de Tópicos
  const [prefs, setPrefs] = useState({
    financeiro: true,
    comercial: true,
    operacional: true,
    sistema: true
  });

  // 1. Carrega tudo ao iniciar
  useEffect(() => {
    // Verifica se é iPhone/iPad
    const iosCheck = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iosCheck);
    // Verifica se está instalado como App (PWA)
    const standaloneCheck = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standaloneCheck);

    async function init() {
      if (!userId) return;
      
      // Carrega preferências do banco
      const { data, error } = await supabase
        .from('usuarios')
        .select('preferencias_notificacao')
        .eq('id', userId)
        .single();

      if (!error && data?.preferencias_notificacao) {
        setPrefs(prev => ({ ...prev, ...data.preferencias_notificacao }));
      }

      // Verifica permissão do navegador
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
        setPermission(Notification.permission);
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        } catch (e) {
          console.error("Erro ao verificar push:", e);
        }
      }

      setLoading(false);
    }
    init();
  }, [userId]);

  // --- LÓGICA DE DISPOSITIVO (PUSH) ---

  const handleSubscribeDevice = async () => {
    if (!userId) return toast.error("Usuário não identificado.");
    setDeviceLoading(true);

    try {
      // 1. Pedir Permissão ao Navegador (O Gesto do Usuário!)
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.error("Você precisa clicar em 'Permitir' quando o navegador perguntar.");
        setDeviceLoading(false);
        return;
      }

      // 2. Registrar Service Worker e Pegar Chaves
      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidKey) throw new Error("Chave VAPID não configurada no sistema.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      // 3. Salvar Inscrição no Banco
      const subscriptionJSON = subscription.toJSON();
      
      // Busca organizacao_id do usuario para garantir
      const { data: userData } = await supabase.from('usuarios').select('organizacao_id').eq('id', userId).single();

      const { error } = await supabase
        .from('notification_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: subscriptionJSON.endpoint,
          subscription_data: subscriptionJSON,
          organizacao_id: userData?.organizacao_id
        }, { onConflict: 'endpoint' });

      if (error) throw error;

      setIsSubscribed(true);
      toast.success("Dispositivo ativado com sucesso!");

      // Envia notificação de teste
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          title: "Configuração Concluída! 📱",
          message: "Este dispositivo agora receberá avisos do Studio 57.",
          url: "/painel"
        })
      });

    } catch (error) {
      console.error("Erro ao ativar:", error);
      toast.error("Erro ao ativar notificações. Verifique se o app está instalado.");
    } finally {
      setDeviceLoading(false);
    }
  };

  const handleUnsubscribeDevice = async () => {
    setDeviceLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await supabase
          .from('notification_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
      }
      setIsSubscribed(false);
      toast.info("Notificações desativadas neste dispositivo.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao desativar.");
    } finally {
      setDeviceLoading(false);
    }
  };

  // --- LÓGICA DE PREFERÊNCIAS (TÓPICOS) ---

  const handleSavePrefs = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ preferencias_notificacao: prefs })
        .eq('id', userId);

      if (error) throw error;
      toast.success("Preferências de tópicos salvas!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar preferências.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex justify-center py-10">
        <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400 text-2xl" />
    </div>
  );

  return (
    <div className="space-y-6">
      
      {/* 1. STATUS DO DISPOSITIVO (PUSH) */}
      <div className={`p-6 rounded-lg border shadow-sm ${isSubscribed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FontAwesomeIcon icon={faMobileAlt} className={isSubscribed ? "text-green-600" : "text-gray-400"} />
              Status deste Dispositivo
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {isSubscribed 
                ? "Este dispositivo está autorizado a receber notificações push." 
                : "Ative para receber alertas mesmo com o navegador fechado."}
            </p>
            
            {/* Aviso específico para iOS */}
            {isIOS && !isStandalone && !isSubscribed && (
              <div className="mt-3 p-3 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-200 flex items-start gap-2">
                <FontAwesomeIcon icon={faExclamationTriangle} className="mt-0.5" />
                <span>
                  <strong>Atenção iPhone:</strong> Para ativar notificações, toque no botão 
                  <span className="font-bold mx-1">Compartilhar</span> 
                  e escolha <span className="font-bold">"Adicionar à Tela de Início"</span>. 
                  Depois, abra o app criado e volte aqui.
                </span>
              </div>
            )}
          </div>

          <button
            onClick={isSubscribed ? handleUnsubscribeDevice : handleSubscribeDevice}
            disabled={deviceLoading || (isIOS && !isStandalone && !isSubscribed)}
            className={`
              px-6 py-3 rounded-lg font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 min-w-[180px]
              ${isSubscribed 
                ? 'bg-white text-red-600 border border-red-200 hover:bg-red-50' 
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500'}
            `}
          >
            {deviceLoading ? (
              <FontAwesomeIcon icon={faSpinner} spin />
            ) : isSubscribed ? (
              <>Desativar neste aparelho</>
            ) : (
              <>Ativar Notificações</>
            )}
          </button>
        </div>
      </div>

      {/* 2. PREFERÊNCIAS DE TÓPICOS */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faBell} className="text-blue-600" />
          Quais alertas você quer receber?
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Isso controla o que aparece no sininho do sistema e no seu celular (se ativado acima).
        </p>

        <div className="space-y-4">
          {/* FINANCEIRO */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full w-10 h-10 flex items-center justify-center transition-colors ${prefs.financeiro ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                <FontAwesomeIcon icon={faMoneyBill} />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Financeiro</p>
                <p className="text-xs text-gray-500">Contas a pagar, recebimentos, fluxo de caixa.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={prefs.financeiro} onChange={() => toggle('financeiro')} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* COMERCIAL */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full w-10 h-10 flex items-center justify-center transition-colors ${prefs.comercial ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                <FontAwesomeIcon icon={faBullhorn} />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Comercial</p>
                <p className="text-xs text-gray-500">Novos leads, vendas, metas batidas.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={prefs.comercial} onChange={() => toggle('comercial')} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* OPERACIONAL */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full w-10 h-10 flex items-center justify-center transition-colors ${prefs.operacional ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-400'}`}>
                <FontAwesomeIcon icon={faHardHat} />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Obras & Operacional</p>
                <p className="text-xs text-gray-500">Pedidos de compra, diário de obra, estoque.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={prefs.operacional} onChange={() => toggle('operacional')} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* SISTEMA */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full w-10 h-10 flex items-center justify-center transition-colors ${prefs.sistema ? 'bg-gray-200 text-gray-600' : 'bg-gray-200 text-gray-400'}`}>
                <FontAwesomeIcon icon={faCog} />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Sistema</p>
                <p className="text-xs text-gray-500">Atualizações, segurança, backups (Críticos sempre ativos).</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={prefs.sistema} onChange={() => toggle('sistema')} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSavePrefs}
            disabled={saving}
            className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
            {saving ? 'Salvando...' : 'Salvar Preferências'}
          </button>
        </div>
      </div>
    </div>
  );
}