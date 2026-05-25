import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faRobot, faTimes, faPlus, faSpinner, faToggleOn, faToggleOff, 
  faPen, faTrash, faArrowRight, faBullhorn, faAd, faPlusCircle, faSave
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import AutomacaoModal from './AutomacaoModal';

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
  if (!organizacaoId) return { regras: [], funis: [], campaigns: [], ads: [] };

  const [
    { data: regras },
    { data: funis },
    { data: contatos },
  ] = await Promise.all([
    supabase.from('regras_roteamento_funil')
      .select('*')
      .eq('organizacao_id', organizacaoId)
      .order('ordem', { ascending: true }),
    supabase.from('funis')
      .select('id, nome, is_sistema')
      .eq('organizacao_id', organizacaoId)
      .order('is_sistema', { ascending: false }),
    supabase.from('contatos')
      .select('meta_campaign_id, meta_campaign_name, meta_ad_id, meta_ad_name')
      .eq('organizacao_id', organizacaoId)
      .not('meta_campaign_id', 'is', null),
  ]);

  const campaigns = [...new Map(
    (contatos || [])
      .filter(c => c.meta_campaign_id && c.meta_campaign_name)
      .map(c => [c.meta_campaign_id, { id: c.meta_campaign_id, nome: c.meta_campaign_name }])
  ).values()].sort((a, b) => a.nome.localeCompare(b.nome));

  const ads = [...new Map(
    (contatos || [])
      .filter(c => c.meta_ad_id && c.meta_ad_name)
      .map(c => [c.meta_ad_id, { id: c.meta_ad_id, nome: c.meta_ad_name }])
  ).values()].sort((a, b) => a.nome.localeCompare(b.nome));

  return { regras: regras || [], funis: funis || [], campaigns, ads };
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
    nome: '',
    campaign_id: '',
    ad_id: '',
    funil_destino_id: '',
  });

  // --- QUERIES ---
  const { data: automations = [], isLoading: isLoadingWhatsApp } = useQuery({
    queryKey: ['automations', organizacaoId],
    queryFn: () => fetchAutomations(supabase, organizacaoId),
    enabled: isOpen && !!organizacaoId && activeTab === 'whatsapp',
  });

  const { data: roteamentoData = { regras: [], funis: [], campaigns: [], ads: [] }, isLoading: isLoadingRouting } = useQuery({
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
  const criarRegraMutation = useMutation({
    mutationFn: async () => {
      const funilId = (roteamentoForm.funil_destino_id || '').trim();
      if (!funilId) throw new Error('Escolha o funil de destino.');
      if (!roteamentoForm.campaign_id && !roteamentoForm.ad_id) {
        throw new Error('Defina pelo menos uma condição (campanha ou anúncio).');
      }
      
      const { error } = await supabase.from('regras_roteamento_funil').insert({
        organizacao_id: organizacaoId,
        nome: roteamentoForm.nome || 'Regra de roteamento',
        campaign_id: roteamentoForm.campaign_id || null,
        ad_id: roteamentoForm.ad_id || null,
        funil_destino_id: funilId,
        ativo: true,
      });
      if (error) throw error;
      return "Regra de roteamento criada!";
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['roteamento', organizacaoId] });
      toast.success(message);
      setIsFormRoteamentoOpen(false);
      setRoteamentoForm({ nome: '', campaign_id: '', ad_id: '', funil_destino_id: '' });
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

  // --- HANDLERS ---
  const handleOpenForm = (automation = null) => {
    setSelectedAutomation(automation);
    setIsFormModalOpen(true);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50] flex justify-center items-center p-4 animate-in fade-in duration-200">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200">
        {/* Header */}
        <div className="bg-[#ff6700] px-6 py-4 flex justify-between items-center text-white shrink-0">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FontAwesomeIcon icon={faRobot} />
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
                ? 'border-[#ff6700] text-[#ff6700]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faRobot} />
            Mensagens de WhatsApp
          </button>
          <button
            onClick={() => setActiveTab('routing')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'routing' 
                ? 'border-[#ff6700] text-[#ff6700]' 
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
                  className="bg-[#ff6700] text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-[#e05a00] transition-colors flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Nova Automação
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                {isLoadingWhatsApp ? (
                  <div className="p-12 flex justify-center items-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-[#ff6700] text-3xl" />
                  </div>
                ) : automations.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
                    <FontAwesomeIcon icon={faRobot} className="text-4xl text-gray-300" />
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
                                  Envia: <span className="font-semibold text-[#ff6700]">{automation.acao_config?.template_nome}</span>
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
                                  <FontAwesomeIcon icon={faPen} />
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
                    <p className="text-sm text-gray-500">Mova leads vindos de campanhas e anúncios da Meta diretamente para funis específicos de forma automática.</p>
                  </div>
                  {!isFormRoteamentoOpen && (
                    <button
                      onClick={() => setIsFormRoteamentoOpen(true)}
                      className="bg-[#ff6700] text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-[#e05a00] transition-colors flex items-center gap-2"
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      Nova Regra
                    </button>
                  )}
                </div>

                {isFormRoteamentoOpen && (
                  <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/30 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <h5 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                      <FontAwesomeIcon icon={faRobot} className="text-[#ff6700]" />
                      Nova Regra de Roteamento
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Nome */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da regra (ex: Leads do Residencial Alfa)</label>
                        <input
                          type="text"
                          placeholder="Ex: Leads do Empreendimento Alfa"
                          value={roteamentoForm.nome}
                          onChange={e => setRoteamentoForm(p => ({ ...p, nome: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#ff6700] text-gray-800"
                        />
                      </div>

                      {/* Destino */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Enviar para o funil (ENTÃO) *</label>
                        <select
                          value={roteamentoForm.funil_destino_id}
                          onChange={e => setRoteamentoForm(p => ({ ...p, funil_destino_id: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#ff6700] text-gray-800 font-medium"
                        >
                          <option value="">-- Escolha o funil destino --</option>
                          {roteamentoData.funis.filter(f => !f.is_sistema).map(f => (
                            <option key={f.id} value={String(f.id)}>{f.nome}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Campanha */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                          <FontAwesomeIcon icon={faBullhorn} className="text-blue-500" />
                          Campanha Meta (SE)
                        </label>
                        <select
                          value={roteamentoForm.campaign_id}
                          onChange={e => setRoteamentoForm(p => ({ ...p, campaign_id: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#ff6700] text-gray-800"
                        >
                          <option value="">Qualquer campanha</option>
                          {roteamentoData.campaigns.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>

                      {/* Anúncio */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                          <FontAwesomeIcon icon={faAd} className="text-purple-500" />
                          Anúncio Meta (SE)
                        </label>
                        <select
                          value={roteamentoForm.ad_id}
                          onChange={e => setRoteamentoForm(p => ({ ...p, ad_id: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#ff6700] text-gray-800"
                        >
                          <option value="">Qualquer anúncio</option>
                          {roteamentoData.ads.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <button 
                        onClick={() => {
                          setIsFormRoteamentoOpen(false);
                          setRoteamentoForm({ nome: '', campaign_id: '', ad_id: '', funil_destino_id: '' });
                        }} 
                        className="px-4 py-2 text-sm text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => criarRegraMutation.mutate()}
                        disabled={criarRegraMutation.isPending}
                        className="px-4 py-2 text-sm font-bold text-white bg-[#ff6700] hover:bg-[#e05a00] disabled:bg-orange-300 rounded-lg transition-colors flex items-center gap-2"
                      >
                        {criarRegraMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
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
                    <FontAwesomeIcon icon={faSpinner} spin className="text-[#ff6700] text-3xl" />
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
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Condições (Filtros Meta)</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                          <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {roteamentoData.regras.map((regra) => {
                          const funilDestino = roteamentoData.funis.find(f => f.id === regra.funil_destino_id);
                          const campaign = roteamentoData.campaigns.find(c => c.id === regra.campaign_id);
                          const ad = roteamentoData.ads.find(a => a.id === regra.ad_id);

                          return (
                            <tr key={regra.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="text-sm font-bold text-gray-900">{regra.nome}</div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                                  Destino: <span className="font-semibold text-emerald-600 flex items-center gap-1">
                                    <FontAwesomeIcon icon={faArrowRight} size="xs" /> {funilDestino?.nome || 'Funil não encontrado'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {!regra.campaign_id && !regra.ad_id ? (
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
                              <td className="px-6 py-4 text-right text-sm font-medium">
                                <button 
                                  onClick={() => handleDeleteRegra(regra)} 
                                  disabled={deleteRegraMutation.isPending}
                                  className="text-red-500 hover:text-red-700 transition-colors"
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
