import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, faPlus, faSpinner, faToggleOn, faToggleOff, 
  faEdit, faTrash, faArrowRight, faBullhorn, faAd, faSave, faGlobe,
  faChevronUp, faChevronDown
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import AutomacaoModal from './AutomacaoModal';
import SparklesIcon from '@/components/shared/SparklesIcon';

// --- FETCHERS ---
const fetchAutomations = async (supabase, organizacaoId) => {
  if (!organizacaoId) return [];
  const { data, error } = await supabase
    .from('automacoes')
    .select('*')
    .eq('organizacao_id', organizacaoId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
};

const fetchDadosRoteamento = async (supabase, organizacaoId) => {
  if (!organizacaoId) return { regras: [], funis: [], campaigns: [], ads: [], origens: [] };

  const [
    { data: regras },
    { data: funis },
    { data: metaCampaigns },
    { data: metaAds },
    { data: contatosOrigens },
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
  ]);

  const campaigns = (metaCampaigns || []).map(c => ({ id: c.id, nome: c.name }));
  const ads = (metaAds || []).map(a => ({ id: a.id, nome: a.name }));
  const origens = [...new Set((contatosOrigens || []).map(c => c.origem))].sort((a, b) => a.localeCompare(b));

  return { regras: regras || [], funis: funis || [], campaigns, ads, origens };
};

export default function AutomacoesListModal({ isOpen, onClose, organizacaoId, currentFunilId }) {
  const supabase = createClient();
  const queryClient = useQueryClient();

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

  // Lista de DDIs padrão comuns
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
  const { data: automations = [], isLoading: isLoadingWhatsApp } = useQuery({
    queryKey: ['automations', organizacaoId],
    queryFn: () => fetchAutomations(supabase, organizacaoId),
    enabled: isOpen && !!organizacaoId && activeTab === 'whatsapp',
  });

  const { data: roteamentoData = { regras: [], funis: [], campaigns: [], ads: [], origens: [] }, isLoading: isLoadingRouting } = useQuery({
    queryKey: ['roteamento', organizacaoId],
    queryFn: () => fetchDadosRoteamento(supabase, organizacaoId),
    enabled: isOpen && !!organizacaoId && activeTab === 'routing',
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
        // Obter maior ordem existente para salvar no final
        const maxOrdem = roteamentoData.regras.reduce((max, r) => r.ordem > max ? r.ordem : max, 0);
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
    mutationFn: async ({ regras, regraId, direction }) => {
      const copy = [...regras];
      const index = copy.findIndex(r => r.id === regraId);
      if (index === -1) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return;

      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;

      // Monta upsert massivo para redefinir as ordens sequencialmente
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

  const handleDelete = (automation) => {
    toast("Confirmar Exclusão", {
      description: `Tem certeza que deseja excluir a automação "${automation.nome}"?`,
      action: {
        label: "Excluir",
        onClick: () => deleteAutomationMutation.mutate(automation.id),
      },
      cancel: { label: "Cancelar" },
      classNames: { actionButton: 'bg-red-600' }
    });
  };

  const handleDeleteRegra = (regra) => {
    toast("Confirmar Exclusão", {
      description: `Tem certeza que deseja excluir a regra "${regra.nome}"?`,
      action: {
        label: "Excluir",
        onClick: () => deleteRegraMutation.mutate(regra.id),
      },
      cancel: { label: "Cancelar" },
      classNames: { actionButton: 'bg-red-600' }
    });
  };

  // Funções auxiliares de Condições
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50] flex justify-center items-center p-4 animate-in fade-in duration-200">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200">
        {/* Header */}
        <div className="bg-gray-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <SparklesIcon className="w-5 h-5" active={true} colorOverride="#FFFFFF" />
            Automações & Roteamento
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10" title="Fechar">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'whatsapp' 
                ? 'border-gray-900 text-gray-900' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <SparklesIcon className="w-4 h-4" active={activeTab === 'whatsapp'} colorOverride={activeTab === 'whatsapp' ? '#F97316' : '#94a3b8'} />
            Mensagens de WhatsApp
          </button>
          <button
            onClick={() => setActiveTab('routing')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'routing' 
                ? 'border-gray-900 text-gray-900' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faArrowRight} />
            Roteamento de Leads (Meta)
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-6">
          
          {/* TAB 1: WHATSAPP AUTOMATIONS */}
          {activeTab === 'whatsapp' && (
            <>
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm shrink-0">
                <div>
                  <h4 className="font-bold text-gray-800 text-base">Mensagens Automáticas de WhatsApp</h4>
                  <p className="text-sm text-gray-500">Defina templates de WhatsApp para disparar quando cards entrarem ou se moverem no Kanban.</p>
                </div>
                <button
                  onClick={() => handleOpenForm()}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Nova Automação
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                {isLoadingWhatsApp ? (
                  <div className="p-12 flex justify-center items-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-gray-900 text-3xl" />
                  </div>
                ) : automations.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
                    <SparklesIcon className="w-12 h-12 text-gray-300" active={false} />
                    <p className="text-base font-medium">Nenhuma automação cadastrada.</p>
                    <p className="text-sm">Crie regras para disparar mensagens de boas-vindas, envio de propostas ou lembretes.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-left">
                      <thead className="bg-gray-50/80">
                        <tr>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Nome & Gatilho</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Condições (Filtros)</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
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
                                  Envia: <span className="font-semibold text-blue-600">{automation.acao_config?.template_nome}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {!hasConds ? (
                                  <span className="text-xs text-gray-400 italic">Dispara sempre</span>
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
                                    className={`text-2xl ${automation.ativo ? 'text-green-500' : 'text-gray-300'} hover:scale-110 transition-transform`}
                                  />
                                </button>
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-medium">
                                <button onClick={() => handleOpenForm(automation)} className="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors">
                                  <FontAwesomeIcon icon={faEdit} />
                                </button>
                                <button onClick={() => handleDelete(automation)} className="text-red-500 hover:text-red-700 transition-colors">
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
            </>
          )}

          {/* TAB 2: LEAD ROUTING */}
          {activeTab === 'routing' && (
            <>
              {/* Header Box com formulário inline de Roteamento */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-center shrink-0">
                  <div>
                    <h4 className="font-bold text-gray-800 text-base">Regras de Roteamento Automático de Leads</h4>
                    <p className="text-sm text-gray-500">Mova leads vindos de campanhas, anúncios ou origens de formulários diretamente para funis específicos.</p>
                  </div>
                  {!isFormRoteamentoOpen && (
                    <button
                      onClick={() => {
                        setRoteamentoForm({ id: undefined, nome: '', funil_destino_id: '', conditions: [] });
                        setIsFormRoteamentoOpen(true);
                      }}
                      className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-gray-800 transition-colors flex items-center gap-2"
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      Nova Regra
                    </button>
                  )}
                </div>

                {isFormRoteamentoOpen && (
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <h5 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                      <SparklesIcon className="w-4 h-4" active={true} colorOverride="#111827" />
                      {roteamentoForm.id ? 'Editar Regra de Roteamento' : 'Nova Regra de Roteamento'}
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Nome */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da regra (ex: Leads do Elo 57)</label>
                        <input
                          type="text"
                          placeholder="Ex: Leads do Empreendimento"
                          value={roteamentoForm.nome}
                          onChange={e => setRoteamentoForm(p => ({ ...p, nome: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-900 text-gray-800"
                        />
                      </div>

                      {/* Destino */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Enviar para o funil (ENTÃO) *</label>
                        <select
                          value={roteamentoForm.funil_destino_id}
                          onChange={e => setRoteamentoForm(p => ({ ...p, funil_destino_id: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-900 text-gray-800 font-medium"
                        >
                          <option value="">-- Escolha o funil destino --</option>
                          {roteamentoData.funis.filter(f => !f.is_sistema).map(f => (
                            <option key={f.id} value={String(f.id)}>{f.nome}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* CONSTRUTOR DINÂMICO DE CONDIÇÕES */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Condições de Correspondência (SE...)</label>
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
                          Nenhuma condição adicionada. Esta regra não corresponderá a nenhum lead. Adicione uma condição.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {roteamentoForm.conditions.map((cond, idx) => {
                            const activeFields = roteamentoForm.conditions.map(c => c.field);
                            const isDefaultOrFound = ['Site', 'Meta Lead Ads', 'Meta Lead Organico', 'Meta Lead Ad', 'WhatsApp'].includes(cond.value) || roteamentoData.origens.includes(cond.value);
                            return (
                              <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
                                <span className="text-xs font-bold text-gray-400 w-8 text-center">{idx === 0 ? 'SE' : 'E'}</span>
                                
                                {/* Campo */}
                                <select
                                  value={cond.field}
                                  onChange={e => handleConditionChange(idx, 'field', e.target.value)}
                                  className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-50 text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 font-semibold"
                                >
                                  <option value="campaign_id" disabled={activeFields.includes('campaign_id') && cond.field !== 'campaign_id'}>Campanha Meta</option>
                                  <option value="ad_id" disabled={activeFields.includes('ad_id') && cond.field !== 'ad_id'}>Anúncio Meta</option>
                                  <option value="origem" disabled={activeFields.includes('origem') && cond.field !== 'origem'}>Origem do Lead</option>
                                  <option value="country_code" disabled={activeFields.includes('country_code') && cond.field !== 'country_code'}>Código de País (DDI)</option>
                                </select>

                                <span className="text-xs text-gray-500 font-semibold">for igual a</span>

                                {/* Valor */}
                                <div className="flex-grow">
                                  {cond.field === 'campaign_id' && (
                                    <select
                                      value={cond.value}
                                      onChange={e => handleConditionChange(idx, 'value', e.target.value)}
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900"
                                    >
                                      <option value="">Selecione a campanha...</option>
                                      {roteamentoData.campaigns.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                  )}

                                  {cond.field === 'ad_id' && (
                                    <select
                                      value={cond.value}
                                      onChange={e => handleConditionChange(idx, 'value', e.target.value)}
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900"
                                    >
                                      <option value="">Selecione o anúncio...</option>
                                      {roteamentoData.ads.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
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
                                        {roteamentoData.origens.filter(o => !['Site', 'Meta Lead Ads', 'Meta Lead Organico', 'Meta Lead Ad', 'WhatsApp', ''].includes(o)).map(o => (
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

                    <div className="flex gap-2 justify-end pt-2">
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
              </div>

              {/* Tabela de regras de roteamento cadastradas */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                {isLoadingRouting ? (
                  <div className="p-12 flex justify-center items-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-gray-900 text-3xl" />
                  </div>
                ) : roteamentoData.regras.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
                    <FontAwesomeIcon icon={faArrowRight} className="text-4xl text-gray-300" />
                    <p className="text-base font-medium">Nenhuma regra de roteamento cadastrada.</p>
                    <p className="text-sm">Todos os leads recém-criados pousarão no Funil de Entrada padrão do sistema.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-left">
                      <thead className="bg-gray-50/80">
                        <tr>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Regra & Destino</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Condições (Filtros Meta / Origem / DDI)</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Prioridade</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {roteamentoData.regras.map((regra, index) => {
                          const funilDestino = roteamentoData.funis.find(f => f.id === regra.funil_destino_id);
                          const campaign = roteamentoData.campaigns.find(c => c.id === regra.campaign_id);
                          const ad = roteamentoData.ads.find(a => a.id === regra.ad_id);
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
                                <button 
                                  onClick={() => toggleRegraMutation.mutate({ id: regra.id, newStatus: !regra.ativo })}
                                  disabled={toggleRegraMutation.isPending}
                                >
                                  <FontAwesomeIcon
                                    icon={regra.ativo ? faToggleOn : faToggleOff}
                                    className={`text-2xl ${regra.ativo ? 'text-green-500' : 'text-gray-300'} hover:scale-110 transition-transform`}
                                  />
                                </button>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex justify-center gap-1">
                                  <button
                                    onClick={() => reorderRegraMutation.mutate({ regras: roteamentoData.regras, regraId: regra.id, direction: 'up' })}
                                    disabled={reorderRegraMutation.isPending || index === 0}
                                    className="text-gray-400 hover:text-gray-900 disabled:opacity-30 transition-colors p-1"
                                    title="Aumentar prioridade"
                                  >
                                    <FontAwesomeIcon icon={faChevronUp} />
                                  </button>
                                  <button
                                    onClick={() => reorderRegraMutation.mutate({ regras: roteamentoData.regras, regraId: regra.id, direction: 'down' })}
                                    disabled={reorderRegraMutation.isPending || index === roteamentoData.regras.length - 1}
                                    className="text-gray-400 hover:text-gray-900 disabled:opacity-30 transition-colors p-1"
                                    title="Diminuir prioridade"
                                  >
                                    <FontAwesomeIcon icon={faChevronDown} />
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-medium">
                                <button 
                                  onClick={() => handleEditRegra(regra)} 
                                  className="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors font-medium"
                                  title="Editar regra"
                                >
                                  <FontAwesomeIcon icon={faEdit} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteRegra(regra)} 
                                  disabled={deleteRegraMutation.isPending}
                                  className="text-red-500 hover:text-red-700 transition-colors"
                                  title="Excluir regra"
                                >
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
            </>
          )}
        </div>
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
