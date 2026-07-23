// app/(main)/crm/automacao/page.js
"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faToggleOn, faToggleOff,
  faSpinner, faChevronDown, faChevronUp, faArrowRight,
  faBullhorn, faAd, faGlobe, faEdit, faSave
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import SparklesIcon from '@/components/shared/SparklesIcon';
import AutomacaoModal from '@/components/crm/AutomacaoModal';

const supabase = createClient();

// --- FETCHERS ---
const fetchDadosRoteamento = async (organizacaoId) => {
  if (!organizacaoId) return { regras: [], funis: [], campaigns: [], ads: [], origens: [], org: null };

  const [
    { data: regras },
    { data: funis },
    { data: metaCampaigns },
    { data: metaAds },
    { data: contatosOrigens },
    { data: org },
  ] = await Promise.all([
    supabase.from('regras_roteamento_funil')
      .select('*')
      .eq('organizacao_id', organizacaoId)
      .order('ordem', { ascending: true }),
    supabase.from('funis')
      .select('id, nome, is_sistema')
      .eq('organizacao_id', organizacaoId)
      .order('is_sistema', { ascending: false }),
    supabase.from('meta_campaigns')
      .select('id, name')
      .eq('organizacao_id', organizacaoId)
      .order('name', { ascending: true }),
    supabase.from('meta_ads')
      .select('id, name')
      .eq('organizacao_id', organizacaoId)
      .order('name', { ascending: true }),
    // Busca origens dos 5000 contatos mais recentes para evitar scan completo e pegar dados novos
    supabase.from('contatos')
      .select('origem')
      .eq('organizacao_id', organizacaoId)
      .not('origem', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase.from('organizacoes')
      .select('id, nome, stella_ativa')
      .eq('id', organizacaoId)
      .maybeSingle(),
  ]);

  const campaigns = (metaCampaigns || []).map(c => ({ id: c.id, nome: c.name }));
  const ads = (metaAds || []).map(a => ({ id: a.id, nome: a.name }));
  const origens = [...new Set((contatosOrigens || []).map(c => c.origem))].sort((a, b) => a.localeCompare(b));

  return { 
    regras: regras || [], 
    funis: funis || [], 
    campaigns, 
    ads, 
    origens, 
    org: org || null 
  };
};

const fetchAutomations = async (organizacaoId) => {
  if (!organizacaoId) return [];
  const { data, error } = await supabase
    .from('automacoes')
    .select('*')
    .eq('organizacao_id', organizacaoId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
};

export default function AutomacaoPage() {
  const { setPageTitle } = useLayout();
  const { user } = useAuth();
  const organizacaoId = user?.organizacao_id;
  const queryClient = useQueryClient();

  useEffect(() => { if (setPageTitle) setPageTitle('CRM - Automação & Roteamento'); }, [setPageTitle]);

  const [activeTab, setActiveTab] = useState('whatsapp'); // 'whatsapp' ou 'routing'
  
  // States para Automações de WhatsApp
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState(null);

  // States para Roteamento de Leads
  const [isFormRoteamentoOpen, setIsFormRoteamentoOpen] = useState(false);
  const [roteamentoForm, setRoteamentoForm] = useState({
    id: undefined,
    nome: '',
    funil_destino_id: '',
    conditions: [] // array de { field: '', value: '' }
  });

  const ddiList = [
    { code: '+55', label: '+55 (Brasil)' },
    { code: '+1', label: '+1 (EUA / Canadá)' },
    { code: '+351', label: '+351 (Portugal)' },
    { code: '+34', label: '+34 (Espanha)' },
    { code: '+54', label: '+54 (Argentina)' },
    { code: '+44', label: '+44 (Reino Unido)' },
    { code: '+39', label: '+39 (Itália)' },
    { code: '+49', label: '+49 (Alemanha)' },
    { code: '+33', label: '+33 (França)' },
    { code: '+598', label: '+598 (Uruguai)' },
    { code: '+56', label: '+56 (Chile)' },
    { code: '+57', label: '+57 (Colômbia)' }
  ];

  // --- QUERIES ---
  const { data: routeData, isLoading: isLoadingRouting } = useQuery({
    queryKey: ['roteamento', organizacaoId],
    queryFn: () => fetchDadosRoteamento(organizacaoId),
    enabled: !!organizacaoId,
  });

  const { data: automations = [], isLoading: isLoadingWhatsApp } = useQuery({
    queryKey: ['automations', organizacaoId],
    queryFn: () => fetchAutomations(organizacaoId),
    enabled: !!organizacaoId,
  });

  const { regras = [], funis = [], campaigns = [], ads = [], origens = [], org = null } = routeData || {};
  const isStellaAtiva = org?.stella_ativa !== false;

  // --- MUTATIONS: STELLA IA ---
  const toggleStellaMutation = useMutation({
    mutationFn: async (newValue) => {
      const { error } = await supabase
        .from('organizacoes')
        .update({ stella_ativa: newValue })
        .eq('id', organizacaoId);
      if (error) throw error;
      return newValue;
    },
    onSuccess: (val) => {
      queryClient.invalidateQueries({ queryKey: ['roteamento', organizacaoId] });
      toast.success(`Stella IA ${val ? 'ativada' : 'desativada'} globalmente para a organização!`);
    },
    onError: (err) => {
      toast.error(`Erro ao alterar status da Stella IA: ${err.message}`);
    }
  });

  // --- MUTATIONS: WHATSAPP ---
  const saveAutomationMutation = useMutation({
    mutationFn: async (automationData) => {
      const { error } = await supabase.from('automacoes').upsert(automationData).select();
      if (error) throw error;
      return automationData.id ? "Automação atualizada!" : "Automação criada!";
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['automations', organizacaoId] });
      toast.success(message);
      setIsFormModalOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAutomationMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('automacoes').delete().eq('id', id);
      if (error) throw error;
      return "Automação excluída!";
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['automations', organizacaoId] });
      toast.success(message);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleAutomationMutation = useMutation({
    mutationFn: async ({ id, newStatus }) => {
      const { error } = await supabase.from('automacoes').update({ ativo: newStatus }).eq('id', id);
      if (error) throw error;
      return `Automação ${newStatus ? 'ativada' : 'desativada'}!`;
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['automations', organizacaoId] });
      toast.success(message);
    },
    onError: (err) => toast.error(err.message),
  });

  // --- MUTATIONS: ROTEAMENTO ---
  const saveRegraMutation = useMutation({
    mutationFn: async () => {
      const funilId = (roteamentoForm.funil_destino_id || '').trim();
      if (!funilId) throw new Error('Escolha o funil de destino.');
      if (roteamentoForm.conditions.length === 0) {
        throw new Error('Adicione pelo menos uma condição para a regra.');
      }
      
      const hasEmptyValue = roteamentoForm.conditions.some(c => !c.field || !c.value);
      if (hasEmptyValue) {
        throw new Error('Preencha os valores de todas as condições criadas.');
      }

      // Mapeia condições dinâmicas para as colunas estruturadas da tabela
      const campaignCond = roteamentoForm.conditions.find(c => c.field === 'campaign_id');
      const adCond = roteamentoForm.conditions.find(c => c.field === 'ad_id');
      const origemCond = roteamentoForm.conditions.find(c => c.field === 'origem');
      const countryCond = roteamentoForm.conditions.find(c => c.field === 'country_code');

      const payload = {
        organizacao_id: organizacaoId,
        nome: roteamentoForm.nome || 'Regra de roteamento',
        campaign_id: campaignCond ? campaignCond.value : null,
        ad_id: adCond ? adCond.value : null,
        origem: origemCond ? origemCond.value : null,
        country_code: countryCond ? countryCond.value : null,
        funil_destino_id: funilId,
        ativo: true,
      };

      if (roteamentoForm.id) {
        payload.id = roteamentoForm.id;
        const { error } = await supabase.from('regras_roteamento_funil').update(payload).eq('id', roteamentoForm.id);
        if (error) throw error;
        return "Regra de roteamento atualizada!";
      } else {
        const maxOrdem = regras.reduce((max, r) => r.ordem > max ? r.ordem : max, 0);
        payload.ordem = maxOrdem + 1;
        const { error } = await supabase.from('regras_roteamento_funil').insert(payload);
        if (error) throw error;
        return "Regra de roteamento criada!";
      }
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['roteamento', organizacaoId] });
      toast.success(message);
      setIsFormRoteamentoOpen(false);
      setRoteamentoForm({ id: undefined, nome: '', funil_destino_id: '', conditions: [] });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteRegraMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('regras_roteamento_funil').delete().eq('id', id);
      if (error) throw error;
      return "Regra de roteamento excluída!";
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['roteamento', organizacaoId] });
      toast.success(message);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleRegraMutation = useMutation({
    mutationFn: async ({ id, newStatus }) => {
      const { error } = await supabase.from('regras_roteamento_funil').update({ ativo: newStatus }).eq('id', id);
      if (error) throw error;
      return `Regra ${newStatus ? 'ativada' : 'desativada'}!`;
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['roteamento', organizacaoId] });
      toast.success(message);
    },
    onError: (err) => toast.error(err.message),
  });

  const reorderRegraMutation = useMutation({
    mutationFn: async ({ regrasList, regraId, direction }) => {
      const copy = [...regrasList];
      const index = copy.findIndex(r => r.id === regraId);
      if (index === -1) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return;

      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;

      const updates = copy.map((r, idx) => ({
        id: r.id,
        organizacao_id: organizacaoId,
        nome: r.nome,
        funil_destino_id: r.funil_destino_id,
        campaign_id: r.campaign_id,
        ad_id: r.ad_id,
        origem: r.origem,
        country_code: r.country_code,
        ativo: r.ativo,
        ordem: idx
      }));

      const { error } = await supabase.from('regras_roteamento_funil').upsert(updates);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roteamento', organizacaoId] });
      toast.success("Prioridade das regras atualizada!");
    },
    onError: (err) => toast.error("Erro ao reordenar: " + err.message),
  });

  // --- HANDLERS ---
  const handleOpenForm = (automation = null) => {
    setSelectedAutomation(automation);
    setIsFormModalOpen(true);
  };

  const handleEditRegra = (regra) => {
    const conditions = [];
    if (regra.campaign_id) conditions.push({ field: 'campaign_id', value: regra.campaign_id });
    if (regra.ad_id) conditions.push({ field: 'ad_id', value: regra.ad_id });
    if (regra.origem) conditions.push({ field: 'origem', value: regra.origem });
    if (regra.country_code) conditions.push({ field: 'country_code', value: regra.country_code });

    setRoteamentoForm({
      id: regra.id,
      nome: regra.nome || '',
      funil_destino_id: regra.funil_destino_id || '',
      conditions
    });
    setIsFormRoteamentoOpen(true);
  };

  const handleAddCondition = () => {
    const activeFields = roteamentoForm.conditions.map(c => c.field);
    const availableFields = ['campaign_id', 'ad_id', 'origem', 'country_code'].filter(f => !activeFields.includes(f));
    
    if (availableFields.length === 0) {
      toast.error('Todos os critérios já foram adicionados a esta regra.');
      return;
    }

    setRoteamentoForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: availableFields[0], value: '' }]
    }));
  };

  const handleRemoveCondition = (index) => {
    setRoteamentoForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, idx) => idx !== index)
    }));
  };

  const handleConditionChange = (index, field, value) => {
    setRoteamentoForm(prev => {
      const copy = [...prev.conditions];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, conditions: copy };
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <SparklesIcon className="w-6 h-6" active={true} />
            Automação & Roteamento
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure o robô SDR e defina regras para mensagens automáticas e roteamento de novos leads.
          </p>
        </div>
      </div>

      {/* Disjuntor Global Stella IA */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${isStellaAtiva ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-400'} transition-colors`}>
            <SparklesIcon className="w-6 h-6" active={isStellaAtiva} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              Piloto Automático Stella IA (SDR)
              <span className={`px-2 py-0.5 rounded-full text-2xs font-bold ${isStellaAtiva ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-600'}`}>
                {isStellaAtiva ? 'ATIVADO' : 'DESATIVADO'}
              </span>
            </h3>
            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
              Ative ou desative o piloto automático global da Stella para toda a sua organização. Se desativado, nenhum lead novo ou qualificado será respondido pela Inteligência Artificial.
            </p>
          </div>
        </div>
        
        <button
          onClick={() => toggleStellaMutation.mutate(!isStellaAtiva)}
          disabled={toggleStellaMutation.isPending}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all focus:ring-4 focus:ring-orange-100 disabled:opacity-50 ${
            isStellaAtiva
              ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-sm shadow-orange-200'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {toggleStellaMutation.isPending ? (
            <FontAwesomeIcon icon={faSpinner} spin />
          ) : (
            <FontAwesomeIcon icon={isStellaAtiva ? faToggleOn : faToggleOff} className="text-lg" />
          )}
          {isStellaAtiva ? 'Desativar IA' : 'Ativar IA'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-xl shadow-2xs overflow-hidden">
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`flex-1 py-3.5 font-bold text-sm transition-colors border-b-2 text-center flex justify-center items-center gap-2 ${
            activeTab === 'whatsapp'
              ? 'border-gray-900 text-gray-900 bg-gray-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/10'
          }`}
        >
          <SparklesIcon className="w-4 h-4" active={activeTab === 'whatsapp'} colorOverride={activeTab === 'whatsapp' ? '#F97316' : '#94a3b8'} />
          Mensagens Automáticas de WhatsApp
        </button>
        <button
          onClick={() => setActiveTab('routing')}
          className={`flex-1 py-3.5 font-bold text-sm transition-colors border-b-2 text-center flex justify-center items-center gap-2 ${
            activeTab === 'routing'
              ? 'border-gray-900 text-gray-900 bg-gray-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/10'
          }`}
        >
          <FontAwesomeIcon icon={faArrowRight} />
          Roteamento de Leads (Meta / Origem / DDI)
        </button>
      </div>

      {/* Content Area */}
      <div className="space-y-6">
        
        {/* TAB 1: WHATSAPP AUTOMATIONS */}
        {activeTab === 'whatsapp' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-800 text-base">Mensagens de WhatsApp no Kanban</h2>
                <p className="text-sm text-gray-500">Defina templates para enviar quando cards forem criados ou movidos de coluna.</p>
              </div>
              <button
                onClick={() => handleOpenForm()}
                className="bg-gray-900 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-sm"
              >
                <FontAwesomeIcon icon={faPlus} />
                Nova Automação
              </button>
            </div>

            {isLoadingWhatsApp ? (
              <div className="flex justify-center py-8">
                <FontAwesomeIcon icon={faSpinner} spin className="text-gray-900 text-2xl" />
              </div>
            ) : automations.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <SparklesIcon className="text-5xl mb-3 opacity-20" active={false} />
                <p className="font-medium">Nenhuma automação cadastrada ainda.</p>
                <p className="text-sm">Configure sua primeira mensagem automática para o Kanban comercial.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200 text-left">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Regra / Gatilho</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Filtros Opcionais</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Ativo</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {automations.map((automation) => {
                      const conds = automation.gatilho_config?.condicoes || {};
                      const hasConds = Object.keys(conds).length > 0;

                      return (
                        <tr key={automation.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-gray-900">{automation.nome}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Template: <span className="font-semibold text-blue-600">{automation.acao_config?.template_nome}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {!hasConds ? (
                              <span className="text-xs text-gray-400 italic">Sem filtros (Dispara sempre)</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {conds.tipo && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded w-fit">Tipo: {conds.tipo}</span>}
                                {conds.campanha_id && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded w-fit">Campanha Específica</span>}
                                {conds.origem && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded w-fit">Origem: {conds.origem}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => toggleAutomationMutation.mutate({ id: automation.id, newStatus: !automation.ativo })}>
                              <FontAwesomeIcon
                                icon={automation.ativo ? faToggleOn : faToggleOff}
                                className={`text-2xl ${automation.ativo ? 'text-green-500' : 'text-gray-300'}`}
                              />
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium">
                            <button onClick={() => handleOpenForm(automation)} className="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors">
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button onClick={() => { if (confirm('Excluir esta automação?')) deleteAutomationMutation.mutate(automation.id); }} className="text-red-500 hover:text-red-700 transition-colors">
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LEAD ROUTING */}
        {activeTab === 'routing' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-800 text-base">Regras de Roteamento Automático</h2>
                <p className="text-sm text-gray-500">Mova leads para outros funis com base em múltiplos critérios combinados (E/AND).</p>
              </div>
              {!isFormRoteamentoOpen && (
                <button
                  onClick={() => {
                    setRoteamentoForm({ id: undefined, nome: '', funil_destino_id: '', conditions: [] });
                    setIsFormRoteamentoOpen(true);
                  }}
                  className="bg-gray-900 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-sm"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Nova Regra
                </button>
              )}
            </div>

            {isFormRoteamentoOpen && (
              <div className="border border-gray-200 rounded-xl p-5 bg-gray-50/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4" active={true} colorOverride="#111827" />
                  {roteamentoForm.id ? 'Editar Regra de Roteamento' : 'Nova Regra de Roteamento'}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nome */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da regra (opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: Leads de Portugal para Funil X"
                      value={roteamentoForm.nome}
                      onChange={e => setRoteamentoForm(p => ({ ...p, nome: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-900 text-gray-800"
                    />
                  </div>

                  {/* Destino */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Mover para o funil (ENTÃO) *</label>
                    <select
                      value={roteamentoForm.funil_destino_id}
                      onChange={e => setRoteamentoForm(p => ({ ...p, funil_destino_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-900 text-gray-800 font-semibold"
                    >
                      <option value="">-- Escolha o funil destino --</option>
                      {funis.filter(f => !f.is_sistema).map(f => (
                        <option key={f.id} value={String(f.id)}>{f.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* CONSTRUTOR DINÂMICO */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Filtros de Entrada (SE...)</label>
                    <button
                      type="button"
                      onClick={handleAddCondition}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      Adicionar Condição
                    </button>
                  </div>

                  {roteamentoForm.conditions.length === 0 ? (
                    <div className="text-center py-4 bg-white border border-dashed rounded-lg text-gray-400 text-xs">
                      Nenhum critério adicionado ainda. Adicione pelo menos uma condição para rotear leads.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {roteamentoForm.conditions.map((cond, idx) => {
                        const activeFields = roteamentoForm.conditions.map(c => c.field);
                        const isDefaultOrFound = ['Site', 'Meta Lead Ads', 'Meta Lead Organico', 'Meta Lead Ad', 'WhatsApp'].includes(cond.value) || origens.includes(cond.value);
                        return (
                          <div key={idx} className="flex gap-2 items-center bg-white p-2.5 rounded-lg border border-gray-200 shadow-3xs">
                            <span className="text-xs font-bold text-gray-400 w-8 text-center">{idx === 0 ? 'SE' : 'E'}</span>
                            
                            <select
                              value={cond.field}
                              onChange={e => handleConditionChange(idx, 'field', e.target.value)}
                              className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-50 text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 font-bold"
                            >
                              <option value="campaign_id" disabled={activeFields.includes('campaign_id') && cond.field !== 'campaign_id'}>Campanha Meta</option>
                              <option value="ad_id" disabled={activeFields.includes('ad_id') && cond.field !== 'ad_id'}>Anúncio Meta</option>
                              <option value="origem" disabled={activeFields.includes('origem') && cond.field !== 'origem'}>Origem do Lead</option>
                              <option value="country_code" disabled={activeFields.includes('country_code') && cond.field !== 'country_code'}>Código de País (DDI)</option>
                            </select>

                            <span className="text-xs text-gray-500">for igual a</span>

                            <div className="flex-grow">
                              {cond.field === 'campaign_id' && (
                                <select
                                  value={cond.value}
                                  onChange={e => handleConditionChange(idx, 'value', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900"
                                >
                                  <option value="">Selecione a campanha...</option>
                                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                </select>
                              )}

                              {cond.field === 'ad_id' && (
                                <select
                                  value={cond.value}
                                  onChange={e => handleConditionChange(idx, 'value', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900"
                                >
                                  <option value="">Selecione o anúncio...</option>
                                  {ads.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                </select>
                              )}

                               {cond.field === 'origem' && (
                                 <div className="flex gap-2 w-full">
                                   <select
                                     value={cond.value === '' ? '' : (isDefaultOrFound ? cond.value : 'outro')}
                                     onChange={e => {
                                       const val = e.target.value;
                                       if (val === 'outro') {
                                         handleConditionChange(idx, 'value', 'Nova Origem');
                                       } else {
                                         handleConditionChange(idx, 'value', val);
                                       }
                                     }}
                                     className="flex-grow px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 font-semibold"
                                   >
                                     <option value="">Selecione a origem...</option>
                                     <option value="Site">Site</option>
                                     <option value="Meta Lead Ads">Meta Lead Ads</option>
                                     <option value="Meta Lead Organico">Meta Lead Organico</option>
                                     <option value="Meta Lead Ad">Meta Lead Ad</option>
                                     <option value="WhatsApp">WhatsApp</option>
                                     {origens.filter(o => !['Site', 'Meta Lead Ads', 'Meta Lead Organico', 'Meta Lead Ad', 'WhatsApp', ''].includes(o)).map(o => (
                                       <option key={o} value={o}>{o}</option>
                                     ))}
                                     <option value="outro">Outro (Digitar...)</option>
                                   </select>
                                   
                                   {(cond.value !== '' && !isDefaultOrFound || cond.value === 'Nova Origem') && (
                                     <input
                                       type="text"
                                       placeholder="Digite a origem exata..."
                                       value={cond.value === 'Nova Origem' ? '' : cond.value}
                                       onChange={e => handleConditionChange(idx, 'value', e.target.value)}
                                       className="w-1/2 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900"
                                     />
                                   )}
                                 </div>
                               )}

                              {cond.field === 'country_code' && (
                                <select
                                  value={cond.value}
                                  onChange={e => handleConditionChange(idx, 'value', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900"
                                >
                                  <option value="">Selecione o DDI...</option>
                                  {ddiList.map(ddi => <option key={ddi.code} value={ddi.code}>{ddi.label}</option>)}
                                </select>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveCondition(idx)}
                              className="text-red-500 hover:text-red-700 transition-colors p-1"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end pt-3">
                  <button 
                    onClick={() => {
                      setIsFormRoteamentoOpen(false);
                      setRoteamentoForm({ id: undefined, nome: '', funil_destino_id: '', conditions: [] });
                    }} 
                    className="px-4 py-2 text-sm text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => saveRegraMutation.mutate()}
                    disabled={saveRegraMutation.isPending}
                    className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {saveRegraMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                    Salvar Regra
                  </button>
                </div>
              </div>
            )}

            {/* Listagem de Regras de Roteamento */}
            {isLoadingRouting ? (
              <div className="flex justify-center py-8">
                <FontAwesomeIcon icon={faSpinner} spin className="text-gray-900 text-2xl" />
              </div>
            ) : regras.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FontAwesomeIcon icon={faArrowRight} className="text-5xl mb-3 opacity-20" />
                <p className="font-medium">Nenhuma regra de roteamento criada.</p>
                <p className="text-sm">Todos os leads recém-criados serão mantidos no funil de entrada padrão.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200 text-left">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Regra / Destino</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Condições (Filtros)</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Prioridade</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {regras.map((regra, index) => {
                      const funilDestino = funis.find(f => f.id === regra.funil_destino_id);
                      const campaign = campaigns.find(c => c.id === regra.campaign_id);
                      const ad = ads.find(a => a.id === regra.ad_id);
                      const ddiLabel = ddiList.find(d => d.code === regra.country_code)?.label || regra.country_code;

                      return (
                        <tr key={regra.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-gray-900">{regra.nome}</div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                              Destino: <span className="font-semibold text-blue-600 flex items-center gap-1">
                                <FontAwesomeIcon icon={faArrowRight} size="xs" /> {funilDestino?.nome || 'Funil não encontrado'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {!regra.campaign_id && !regra.ad_id && !regra.origem && !regra.country_code ? (
                              <span className="text-xs text-gray-400 italic">Qualquer Lead</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {regra.campaign_id && (
                                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded w-fit flex items-center gap-1">
                                    <FontAwesomeIcon icon={faBullhorn} className="text-blue-400" />
                                    Campanha: {campaign?.nome || `ID: ${regra.campaign_id}`}
                                  </span>
                                )}
                                {regra.ad_id && (
                                  <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded w-fit flex items-center gap-1">
                                    <FontAwesomeIcon icon={faAd} className="text-purple-400" />
                                    Anúncio: {ad?.nome || `ID: ${regra.ad_id}`}
                                  </span>
                                )}
                                {regra.origem && (
                                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded w-fit flex items-center gap-1">
                                    <FontAwesomeIcon icon={faGlobe} className="text-emerald-400" />
                                    Origem: {regra.origem}
                                  </span>
                                )}
                                {regra.country_code && (
                                  <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded w-fit flex items-center gap-1 font-semibold">
                                    🌍 DDI: {ddiLabel}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => toggleRegraMutation.mutate({ id: regra.id, newStatus: !regra.ativo })}>
                              <FontAwesomeIcon
                                icon={regra.ativo ? faToggleOn : faToggleOff}
                                className={`text-2xl ${regra.ativo ? 'text-green-500' : 'text-gray-300'}`}
                              />
                            </button>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => reorderRegraMutation.mutate({ regrasList: regras, regraId: regra.id, direction: 'up' })}
                                disabled={reorderRegraMutation.isPending || index === 0}
                                className="text-gray-400 hover:text-gray-900 disabled:opacity-30 transition-colors p-1"
                                title="Mover para cima"
                              >
                                <FontAwesomeIcon icon={faChevronUp} />
                              </button>
                              <button
                                onClick={() => reorderRegraMutation.mutate({ regrasList: regras, regraId: regra.id, direction: 'down' })}
                                disabled={reorderRegraMutation.isPending || index === regras.length - 1}
                                className="text-gray-400 hover:text-gray-900 disabled:opacity-30 transition-colors p-1"
                                title="Mover para baixo"
                              >
                                <FontAwesomeIcon icon={faChevronDown} />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium">
                            <button onClick={() => handleEditRegra(regra)} className="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors font-medium">
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button onClick={() => { if (confirm('Excluir esta regra de roteamento?')) deleteRegraMutation.mutate(regra.id); }} className="text-red-500 hover:text-red-700 transition-colors">
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {isFormModalOpen && (
        <AutomacaoModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSave={(data) => saveAutomationMutation.mutate(data)}
          automation={selectedAutomation}
          supabase={supabase}
          organizacaoId={organizacaoId}
        />
      )}
    </div>
  );
}
