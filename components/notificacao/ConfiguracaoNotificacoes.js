"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  faBuilding, faCheck, faCheckCircle, faCog, faMobileAlt, faSave, faSpinner,
  faBell, faUserShield, faToggleOn, faToggleOff, faDesktop, faUsers
} from '@fortawesome/free-solid-svg-icons';
import { renderIcon } from './constants';

const mapTabela = {
  'contas_pagar': 'Contas a Pagar',
  'contas_receber': 'Contas a Receber',
  'contratos': 'Contratos',
  'atividades': 'Atividades/Tarefas',
  'activities': 'Atividades/Tarefas',
  'clientes': 'Clientes',
  'orcamentos': 'Orçamentos',
  'produtos_empreendimento': 'Unidades do Empreendimento',
  'agendamentos': 'Agendamentos'
};

const getDescricaoHumana = (template) => {
   const tabela = mapTabela[template.tabela_alvo] || template.tabela_alvo.replace(/_/g, ' ');
   let acao = "sofrer alteração";
   if (template.evento === 'INSERT') acao = "adicionado(a) ao sistema";
   if (template.evento === 'UPDATE') acao = "modificado(a)";
   if (template.evento === 'DELETE') acao = "excluído(a)";
   
   return `Notifica imediatamente a equipe quando um registro em ${tabela} for ${acao}.`;
};

// Mini-componente de Toggle estilo iOS
const ToggleSwitch = ({ label, active, onChange, icon, disabled = false }) => (
  <div 
    className={`flex items-center justify-between p-3.5 border rounded-2xl transition-all select-none ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer bg-white hover:border-orange-300 hover:shadow-sm'}`} 
    onClick={() => !disabled && !!onChange && onChange()}
  >
     <div className="flex items-center gap-3">
        {icon && <div className={`w-8 h-8 rounded-full flex items-center justify-center ${active ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}><FontAwesomeIcon icon={icon} /></div>}
        <span className={`text-sm font-bold ${active ? 'text-gray-900' : 'text-gray-500'}`}>{label}</span>
     </div>
     <div className={`w-12 h-6 rounded-full transition-colors relative flex items-center shrink-0 ${active ? 'bg-orange-500' : 'bg-gray-200'}`}>
        <div className={`w-5 h-5 bg-white rounded-full shadow bg-blend-lighten absolute transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`}></div>
     </div>
  </div>
);

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

export default function ConfiguracaoNotificacoes() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [deviceLoading, setDeviceLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [supportError, setSupportError] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserId(user.id);
      }
    };
    fetchUser();
  }, []);

  const { data: usuario, isLoading: loadingUserData } = useQuery({
    queryKey: ['usuario_atual_notificacoes', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('usuarios').select('organizacao_id, nome').eq('id', userId).single();
      if (error) {
         console.error("Erro na busca de usuário:", error);
         throw error;
      }
      return data;
    },
    enabled: !!userId
  });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['sys_notification_templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sys_notification_templates').select('*').order('tabela_alvo');
      if (error) throw error;
      return data;
    }
  });

  const { data: configuracoesOrg = [], isLoading: loadingConfigs } = useQuery({
    queryKey: ['sys_org_notification_settings', usuario?.organizacao_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('sys_org_notification_settings').select('*').eq('organizacao_id', usuario.organizacao_id);
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.organizacao_id
  });

  const { data: funcoes = [] } = useQuery({
    queryKey: ['funcoes_org'],
    queryFn: async () => {
      const { data, error } = await supabase.from('funcoes').select('*').order('nome_funcao');
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      setIsIOS(ios);
      setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!ios) setSupportError("Navegador sem suporte a Push.");
        return;
      }
      
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.active && reg.active.scriptURL.includes('custom-sw.js')) {
            return reg.pushManager.getSubscription();
        }
        return null;
      }).then(sub => setIsSubscribed(!!sub)).catch(console.warn);
    }
  }, []);

  const handleSubscribeDevice = async () => {
    if (!userId) return toast.error("Aguarde a identificação do usuário.");
    setDeviceLoading(true);

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let reg of registrations) await reg.unregister();

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error("Permissão de notificação negada.");

      const registration = await navigator.serviceWorker.register('/custom-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Chave VAPID não configurada no servidor.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      const subscriptionJSON = subscription.toJSON();

      const { error: dbError } = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: subscriptionJSON, userId })
      }).then(r => r.json());

      if (dbError) throw new Error("Erro na API interna de inscrição.");

      setIsSubscribed(true);
      toast.success("Dispositivo conectado ao canal seguro!");
    } catch (error) {
      toast.error(`Falha: ${error.message}`);
    } finally {
      setDeviceLoading(false);
    }
  };

  const handleUnsubscribeDevice = async () => {
    setDeviceLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      setIsSubscribed(false);
      toast.info("Aparelho desconectado.");
    } catch (error) {
      toast.error("Erro ao desconectar aparelho.");
    } finally {
      setDeviceLoading(false);
    }
  };

  const saveOrgTemplateMutation = useMutation({
    mutationFn: async (payload) => {
        if (payload.id) {
            const { error } = await supabase.from('sys_org_notification_settings').update(payload).eq('id', payload.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('sys_org_notification_settings').insert({
                ...payload,
                organizacao_id: usuario.organizacao_id
            });
            if (error) throw error;
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries(['sys_org_notification_settings', usuario?.organizacao_id]);
    },
    onError: (err) => {
        toast.error("Erro ao salvar regras: " + err.message);
    }
  });

  const getTemplateConfig = (templateId) => configuracoesOrg.find(c => c.template_id === templateId);

  const handleToggleActive = (templateId) => {
     const conf = getTemplateConfig(templateId);
     const payload = conf ? { ...conf, is_active: !conf.is_active } : { template_id: templateId, is_active: true, funcoes_ids: [], enviar_push: true };
     saveOrgTemplateMutation.mutate(payload);
  };

  const handleTogglePush = (templateId) => {
     const conf = getTemplateConfig(templateId);
     const payload = conf ? { ...conf, enviar_push: !conf.enviar_push } : { template_id: templateId, is_active: false, funcoes_ids: [], enviar_push: true };
     saveOrgTemplateMutation.mutate(payload);
  };

  const handleSelectRole = (templateId, funcaoId) => {
     const conf = getTemplateConfig(templateId);
     let newFuncoes = conf ? [...(conf.funcoes_ids || [])] : [];
     if (newFuncoes.includes(parseInt(funcaoId))) {
        newFuncoes = newFuncoes.filter(f => parseInt(f) !== parseInt(funcaoId));
     } else {
        newFuncoes.push(parseInt(funcaoId));
     }
     const payload = conf ? { ...conf, funcoes_ids: newFuncoes } : { template_id: templateId, is_active: false, funcoes_ids: [parseInt(funcaoId)], enviar_push: true };
     saveOrgTemplateMutation.mutate(payload);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto p-4 sm:p-6 pb-20">
      
      {/* CARD 1: SESSÃO DO DISPOSITIVO */}
      <div className={`p-6 sm:p-8 rounded-3xl border ${isSubscribed ? 'border-green-200 bg-gradient-to-br from-green-50 to-white' : 'border-blue-200 bg-gradient-to-br from-blue-50 to-white'} shadow-sm relative overflow-hidden`}>
        <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-30 ${isSubscribed ? 'bg-green-400' : 'bg-blue-400'}`}></div>
        <div className="flex flex-col gap-6 relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-3">
                <div className={`w-12 h-12 flex items-center justify-center rounded-2xl ${isSubscribed ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                  <FontAwesomeIcon icon={faMobileAlt} className="text-2xl" />
                </div>
                {isSubscribed ? "Aparelho Conectado" : "Ativar neste Aparelho"}
              </h3>
              <p className="text-sm font-medium text-gray-500 mt-2 max-w-lg">
                {isSubscribed 
                  ? "Sua conexão está segura. Você receberá notificações PUSH diretamente neste dispositivo mesmo com o app fechado." 
                  : "Ative a permissão para receber alertas em tempo real. Essencial para corretores e gerentes de equipe."}
              </p>
            </div>
          </div>

          {supportError && <div className="p-4 bg-red-50 text-red-700 text-sm font-bold rounded-xl border border-red-100">{supportError}</div>}
          {isIOS && !isStandalone && <div className="p-4 bg-yellow-50 text-yellow-800 text-sm font-bold rounded-xl border border-yellow-200">Adicione à Tela de Início (Compartilhar e Adicionar à Tela de Início) para que o Push funcione no iPhone.</div>}

          <div className="pt-2">
            {!isSubscribed ? (
              <button 
                onClick={handleSubscribeDevice} 
                disabled={deviceLoading || (isIOS && !isStandalone)} 
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {deviceLoading ? <FontAwesomeIcon icon={faSpinner} spin className="text-xl" /> : <FontAwesomeIcon icon={faBell} className="text-xl" />}
                {deviceLoading ? 'Negociando Chaves...' : 'Conectar Agora'}
              </button>
            ) : (
              <button 
                onClick={handleUnsubscribeDevice} 
                disabled={deviceLoading} 
                className="text-red-500 text-sm font-bold bg-white border border-red-100 px-6 py-3 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2"
              >
                {deviceLoading && <FontAwesomeIcon icon={faSpinner} spin />}
                Desconectar este aparelho
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CARD 2: CONFIGURAÇÕES DA EMPRESA */}
      {(!userId || loadingUserData) && (
         <div className="flex justify-center p-12"><FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-gray-400" /></div>
      )}
      
      {(!loadingUserData && usuario?.organizacao_id) && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <div>
                <h3 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 text-orange-600 flex items-center justify-center rounded-2xl">
                    <FontAwesomeIcon icon={faBuilding} className="text-xl" />
                  </div>
                  Regras da Empresa
                </h3>
                <p className="text-sm font-medium text-gray-500 mt-2">
                  Ligue os avisos que você deseja ativar na sua operação e selecione quem deve recebê-los.
                </p>
             </div>
             <div className="text-xs font-bold text-orange-600 uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm">
                Conta Proprietária
             </div>
          </div>

          <div className="p-4 sm:p-8 space-y-6">
            {loadingTemplates || loadingConfigs ? (
               <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-4xl mb-4 text-orange-500" />
                  <p className="font-bold">Buscando inteligência da rede...</p>
               </div>
            ) : templates.length === 0 ? (
               <div className="py-20 text-center">
                  <p className="text-gray-500 font-medium">Nenhuma notificação foi disponibilizada pela equipe Elo 57 para a rede ainda.</p>
               </div>
            ) : (
               <div className="grid gap-8">
                 {templates.map(template => {
                    const conf = getTemplateConfig(template.id);
                    const isAtivo = conf?.is_active || false;
                    const pushAtivo = conf?.enviar_push || false;
                    const fIds = conf?.funcoes_ids || [];

                    return (
                        <div key={template.id} className={`rounded-3xl p-5 sm:p-7 transition-all border ${isAtivo ? 'bg-white border-orange-200 shadow-md shadow-orange-500/5' : 'bg-gray-50 border-gray-100 opacity-90'}`}>
                           
                           {/* 1. TOPO: Identidade e Toggles */}
                           <div className="flex flex-col lg:flex-row gap-8 lg:items-center justify-between border-b border-gray-100 pb-6 mb-6">
                              <div className="flex items-center gap-4 flex-1">
                                 <div className={`w-14 h-14 flex shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm ${isAtivo ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                    {renderIcon(template.icone)}
                                 </div>
                                 <div>
                                    <h4 className={`font-extrabold text-lg sm:text-xl ${isAtivo ? 'text-gray-900' : 'text-gray-500'}`}>
                                      {template.nome_regra}
                                    </h4>
                                    <p className="text-sm font-medium text-gray-500 mt-1 leading-snug">
                                      {getDescricaoHumana(template)}
                                    </p>
                                 </div>
                              </div>

                              <div className="flex flex-col sm:flex-row gap-3 min-w-[320px]">
                                 <div className="flex-1">
                                    <ToggleSwitch 
                                      label="Sistema (Web)" 
                                      icon={faDesktop} 
                                      active={isAtivo} 
                                      onChange={() => handleToggleActive(template.id)} 
                                    />
                                 </div>
                                 <div className="flex-1">
                                    <ToggleSwitch 
                                      label="Aplicativo (Celular)" 
                                      icon={faMobileAlt} 
                                      active={pushAtivo && isAtivo} 
                                      disabled={!isAtivo}
                                      onChange={() => handleTogglePush(template.id)} 
                                    />
                                 </div>
                              </div>
                           </div>

                           {/* 2. BASE: Roteamento / Equipe (Somente ativo se isAtivo = true) */}
                           <div className={`transition-all duration-300 ${isAtivo ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                              <h5 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faUsers} className="text-orange-500" />
                                Para quem iremos enviar? <span className="text-xs font-normal text-gray-400 ml-1">(Marque os cargos que receberão)</span>
                              </h5>
                              
                              <div className="flex flex-wrap gap-2.5">
                                 {/* O Dono não pode remover se a regra master disser que ele recebe */}
                                 {template.enviar_para_dono && (
                                    <div className="px-4 py-2 border-2 border-orange-200 bg-orange-50 text-orange-700 rounded-xl text-xs font-bold flex items-center gap-2 cursor-help" title="Configuração fixa da Matriz: Quem executou a ação sempre será notificado/acompanhado.">
                                        <FontAwesomeIcon icon={faCheckCircle} /> Agente Autor
                                    </div>
                                 )}
                                 
                                 {/* Grid de Funções (Cargos) da Organização Atual */}
                                 {funcoes.map(funcao => {
                                    const selected = fIds.includes(funcao.id);
                                    return (
                                      <button 
                                         key={funcao.id}
                                         onClick={() => handleSelectRole(template.id, funcao.id)}
                                         className={`px-4 py-2 border-2 rounded-xl text-xs font-bold transition-all
                                           ${selected 
                                             ? 'bg-orange-500 text-white border-orange-500 shadow-sm' 
                                             : 'bg-white text-gray-500 border-gray-100 hover:border-orange-200 hover:bg-orange-50'}`}
                                      >
                                         {funcao.nome_funcao}
                                      </button>
                                    );
                                 })}
                              </div>
                           </div>

                        </div>
                    );
                 })}
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}