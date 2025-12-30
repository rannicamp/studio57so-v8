"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, faEdit, faTrash, faBolt, faToggleOn, faToggleOff, 
  faSpinner, faMobileAlt, faSave,
  // Novos ícones para seleção
  faBell, faMoneyBillWave, faUserPlus, faCheckCircle, 
  faExclamationTriangle, faBirthdayCake, faFileContract, faBriefcase, faBullhorn
} from '@fortawesome/free-solid-svg-icons';
// Importação separada para ícones de marca (Brands)
import { faWhatsapp as faWhatsappBrand } from '@fortawesome/free-brands-svg-icons';

// Mapa de ícones disponíveis para o sistema
const AVAILABLE_ICONS = [
  { icon: faBell, name: 'fa-bell', label: 'Padrão' },
  { icon: faWhatsappBrand, name: 'fa-whatsapp', label: 'WhatsApp' },
  { icon: faMoneyBillWave, name: 'fa-money-bill-wave', label: 'Financeiro' },
  { icon: faUserPlus, name: 'fa-user-plus', label: 'Novo Lead' },
  { icon: faCheckCircle, name: 'fa-check-circle', label: 'Sucesso' },
  { icon: faExclamationTriangle, name: 'fa-exclamation-triangle', label: 'Alerta' },
  { icon: faBirthdayCake, name: 'fa-birthday-cake', label: 'Aniversário' },
  { icon: faFileContract, name: 'fa-file-contract', label: 'Contrato' },
  { icon: faBriefcase, name: 'fa-briefcase', label: 'Trabalho' },
  { icon: faBullhorn, name: 'fa-bullhorn', label: 'Aviso' },
];

// Função auxiliar para renderizar ícone dinâmico
const renderIcon = (iconName, className = "") => {
  const found = AVAILABLE_ICONS.find(i => i.name === iconName);
  return <FontAwesomeIcon icon={found ? found.icon : faBell} className={className} />;
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default function GerenciadorNotificacoes() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  const { data: regras = [], isLoading } = useQuery({
    queryKey: ['regras_notificacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regras_notificacao')
        .select('*')
        .order('id', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: funcoes = [] } = useQuery({
    queryKey: ['funcoes_sistema'],
    queryFn: async () => {
      const { data } = await supabase.from('funcoes').select('id, nome_funcao');
      return data || [];
    }
  });

  const salvarRegraMutation = useMutation({
    mutationFn: async (dados) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userData } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
      
      const { id, ...dadosLimpos } = dados;
      const payload = { ...dadosLimpos, organizacao_id: userData.organizacao_id };

      if (editingRule?.id) {
        const { error } = await supabase.from('regras_notificacao').update(payload).eq('id', editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('regras_notificacao').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['regras_notificacao']);
      toast.success("Regra salva com sucesso!");
      setIsModalOpen(false);
      setEditingRule(null);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`)
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }) => {
      await supabase.from('regras_notificacao').update({ ativo }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries(['regras_notificacao'])
  });

  const excluirRegraMutation = useMutation({
    mutationFn: async (id) => {
      await supabase.from('regras_notificacao').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['regras_notificacao']);
      toast.success("Regra excluída.");
    }
  });

  const handleEdit = (regra) => { setEditingRule(regra); setIsModalOpen(true); };
  const handleNew = () => { setEditingRule(null); setIsModalOpen(true); };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-gray-900 to-gray-800 p-8 rounded-2xl text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FontAwesomeIcon icon={faBolt} className="text-yellow-400" />
            Automação de Notificações
          </h1>
          <p className="text-gray-300 mt-2 max-w-2xl">
            Crie regras inteligentes e defina os ícones para avisar a equipe automaticamente.
          </p>
        </div>
        <button onClick={handleNew} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center gap-2">
          <FontAwesomeIcon icon={faPlus} /> Nova Regra
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin size="3x" /></div>
      ) : regras.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500">Nenhuma regra ativa.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {regras.map((regra) => (
            <div key={regra.id} className={`bg-white p-5 rounded-xl shadow-sm border transition-all ${!regra.ativo ? 'opacity-60 grayscale border-gray-100' : 'border-gray-100 hover:shadow-md'}`}>
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-4">
                  {/* ÍCONE GRANDE */}
                  <div className={`p-4 rounded-xl flex items-center justify-center text-2xl w-16 h-16 ${regra.evento === 'UPDATE' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                    {renderIcon(regra.icone)}
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                      {regra.nome_regra}
                      {regra.enviar_push && <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold flex items-center gap-1"><FontAwesomeIcon icon={faMobileAlt} /> Push</span>}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700 text-xs border">{regra.tabela_alvo}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${regra.evento === 'UPDATE' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>{regra.evento}</span>
                      {regra.coluna_monitorada && (
                        <>
                          <span className="text-xs text-gray-400">se</span>
                          <span className="font-mono bg-yellow-50 text-yellow-700 px-1 rounded text-xs border border-yellow-100">{regra.coluna_monitorada} == {regra.valor_gatilho}</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-2 italic border-l-2 border-gray-200 pl-2">"{regra.titulo_template}"</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleAtivoMutation.mutate({ id: regra.id, ativo: !regra.ativo })} className={`text-2xl p-2 transition-colors ${regra.ativo ? 'text-green-500 hover:text-green-600' : 'text-gray-300 hover:text-gray-400'}`}>
                    <FontAwesomeIcon icon={regra.ativo ? faToggleOn : faToggleOff} />
                  </button>
                  <button onClick={() => handleEdit(regra)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button onClick={() => { if(confirm('Excluir esta regra?')) excluirRegraMutation.mutate(regra.id); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRule ? "Editar Regra" : "Nova Regra"}>
        <RegraForm initialData={editingRule} funcoes={funcoes} onSubmit={(dados) => salvarRegraMutation.mutate(dados)} isSaving={salvarRegraMutation.isPending} />
      </Modal>
    </div>
  );
}

function RegraForm({ initialData, funcoes, onSubmit, isSaving }) {
  const [formData, setFormData] = useState(initialData || {
    nome_regra: '', tabela_alvo: 'whatsapp_messages', evento: 'INSERT',
    coluna_monitorada: '', valor_gatilho: '',
    funcoes_ids: [], enviar_para_dono: false, enviar_push: true,
    titulo_template: 'Nova notificação', mensagem_template: '{conteudo}', link_template: '/', 
    ativo: true, icone: 'fa-bell' // Padrão inicial
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleMultiSelect = (e) => {
    const options = Array.from(e.target.selectedOptions, option => parseInt(option.value));
    setFormData(prev => ({ ...prev, funcoes_ids: options }));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-6">
      
      {/* SEÇÃO 1: NOME E ÍCONE */}
      <div className="flex gap-6 items-start">
        <div className="w-1/3">
            <label className="block text-sm font-bold text-gray-700 mb-2">Ícone da Notificação</label>
            <div className="grid grid-cols-5 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                {AVAILABLE_ICONS.map((item) => (
                    <button
                        key={item.name}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, icone: item.name }))}
                        className={`aspect-square rounded-md flex items-center justify-center text-lg transition-all ${formData.icone === item.name ? 'bg-blue-600 text-white shadow-md scale-110 ring-2 ring-blue-300' : 'text-gray-400 hover:bg-gray-200'}`}
                        title={item.label}
                    >
                        <FontAwesomeIcon icon={item.icon} />
                    </button>
                ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1 text-center">{AVAILABLE_ICONS.find(i => i.name === formData.icone)?.label || 'Ícone Selecionado'}</p>
        </div>

        <div className="w-2/3 space-y-4">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome Interno (Admin)</label>
                <input required name="nome_regra" value={formData.nome_regra} onChange={handleChange} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-200 outline-none" placeholder="Ex: Lead Novo no Funil" />
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Tabela Alvo (Banco de Dados)</label>
                <input required name="tabela_alvo" value={formData.tabela_alvo} onChange={handleChange} className="w-full p-2 border rounded-md font-mono bg-gray-50 text-sm focus:ring-2 focus:ring-blue-200 outline-none" placeholder="ex: activities" />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Evento</label>
          <select name="evento" value={formData.evento} onChange={handleChange} className="w-full p-2 border rounded-md bg-white">
            <option value="INSERT">Ao Criar (INSERT)</option>
            <option value="UPDATE">Ao Atualizar (UPDATE)</option>
            <option value="DELETE">Ao Excluir (DELETE)</option>
          </select>
        </div>
        <div className="flex items-end pb-2">
             <label className="flex items-center gap-3 cursor-pointer bg-gradient-to-r from-blue-50 to-white px-4 py-2 rounded-lg w-full border border-blue-100 hover:shadow-sm transition-shadow">
                <input type="checkbox" name="enviar_push" checked={formData.enviar_push} onChange={handleChange} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                <div>
                    <span className="block text-sm font-bold text-blue-900">Enviar Push Mobile</span>
                    <span className="block text-[10px] text-blue-600">Celular vibrará</span>
                </div>
             </label>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative mt-6">
        <div className="absolute -top-3 left-3 bg-white px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Filtros Opcionais</div>
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Coluna (Opcional)</label>
            <input name="coluna_monitorada" value={formData.coluna_monitorada || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" placeholder="Ex: status" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Valor Gatilho</label>
            <input name="valor_gatilho" value={formData.valor_gatilho || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" placeholder="Ex: Concluído" />
          </div>
        </div>
      </div>

      {/* DESTINATÁRIOS */}
      <div className="border-t pt-6">
        <label className="block text-sm font-bold text-gray-700 mb-2">Quem deve receber?</label>
        <div className="flex gap-4">
            <div className="w-1/2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Cargos Específicos</label>
              <select multiple name="funcoes_ids" value={formData.funcoes_ids || []} onChange={handleMultiSelect} className="w-full p-2 border rounded-md text-sm h-24 bg-white focus:ring-2 focus:ring-blue-200 outline-none">
                {funcoes.map(f => <option key={f.id} value={f.id}>{f.nome_funcao}</option>)}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">Segure Ctrl (ou Cmd) para selecionar vários</p>
            </div>
            <div className="w-1/2 flex items-center">
                 <label className="flex items-center gap-3 cursor-pointer p-4 hover:bg-gray-50 rounded-lg w-full border border-dashed border-gray-300 hover:border-blue-400 transition-colors">
                    <input type="checkbox" name="enviar_para_dono" checked={formData.enviar_para_dono} onChange={handleChange} className="w-5 h-5 text-green-600 rounded" />
                    <div>
                        <span className="block text-sm font-bold text-gray-800">Enviar para o Dono</span>
                        <span className="text-xs text-gray-500">Usuário vinculado ao registro (user_id)</span>
                    </div>
                 </label>
            </div>
        </div>
      </div>

      {/* TEMPLATES */}
      <div className="border-t pt-6 bg-yellow-50/50 p-4 rounded-lg border border-yellow-100">
        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faEdit} className="text-yellow-500"/> Mensagem Personalizada</h4>
        <div className="space-y-3">
            <div>
            <input required name="titulo_template" value={formData.titulo_template} onChange={handleChange} className="w-full p-2 border rounded-md font-bold focus:ring-2 focus:ring-yellow-200 outline-none" placeholder="Título (Use {nome}, {id})" />
            </div>
            <div>
            <textarea required name="mensagem_template" value={formData.mensagem_template} onChange={handleChange} rows="2" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-yellow-200 outline-none" placeholder="Mensagem (Use {status}, {valor}, {nome}, etc)" />
            </div>
            <div>
                <input name="link_template" value={formData.link_template || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm text-blue-600 bg-white" placeholder="Link de destino (Ex: /atividades)" />
            </div>
        </div>
        <p className="text-[10px] text-gray-500 mt-2">Dica: Use <strong>{`{nome}`}</strong> para o nome principal e chaves como <strong>{`{status}`}</strong> para pegar dados do registro.</p>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all transform active:scale-95">
          {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
          Salvar Regra
        </button>
      </div>
    </form>
  );
}