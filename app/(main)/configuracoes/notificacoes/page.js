"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, faEdit, faTrash, faBolt, faToggleOn, faToggleOff, 
  faSpinner, faInfoCircle, faUsers, faUserTag, faSave, faMobileAlt 
} from '@fortawesome/free-solid-svg-icons';

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
            Crie regras inteligentes para avisar a equipe automaticamente.
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
                  <div className={`p-3 rounded-lg ${regra.evento === 'UPDATE' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                    <strong className="text-xs uppercase tracking-wider">{regra.evento}</strong>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                      {regra.nome_regra}
                      {regra.enviar_push && <FontAwesomeIcon icon={faMobileAlt} className="text-blue-500 text-sm" title="Envia Push Mobile" />}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                      <span className="font-mono bg-gray-100 px-1 rounded text-gray-700">{regra.tabela_alvo}</span>
                      {regra.coluna_monitorada && (
                        <>
                          <span>quando</span>
                          <span className="font-mono bg-yellow-50 text-yellow-700 px-1 rounded">{regra.coluna_monitorada}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleAtivoMutation.mutate({ id: regra.id, ativo: !regra.ativo })} className={`text-2xl ${regra.ativo ? 'text-green-500' : 'text-gray-300'}`}>
                    <FontAwesomeIcon icon={regra.ativo ? faToggleOn : faToggleOff} />
                  </button>
                  <button onClick={() => handleEdit(regra)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button onClick={() => { if(confirm('Excluir?')) excluirRegraMutation.mutate(regra.id); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
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
    coluna_monitorada: 'direction', valor_gatilho: 'inbound',
    funcoes_ids: [], enviar_para_dono: false, enviar_push: true, // Padrão TRUE para facilitar
    titulo_template: 'Nova mensagem de {sender_id}', mensagem_template: '{content}', link_template: '/chat', ativo: true
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-bold text-gray-700 mb-1">Nome da Regra</label>
          <input required name="nome_regra" value={formData.nome_regra} onChange={handleChange} className="w-full p-2 border rounded-md" placeholder="Ex: WhatsApp Recebido" />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Tabela Alvo</label>
          <input required name="tabela_alvo" value={formData.tabela_alvo} onChange={handleChange} className="w-full p-2 border rounded-md font-mono bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Evento</label>
          <select name="evento" value={formData.evento} onChange={handleChange} className="w-full p-2 border rounded-md">
            <option value="INSERT">Criação (INSERT)</option>
            <option value="UPDATE">Atualização (UPDATE)</option>
          </select>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-bold text-gray-700 mb-2">Condições de Disparo</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500">Coluna Filtro</label>
            <input name="coluna_monitorada" value={formData.coluna_monitorada || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" placeholder="Ex: direction" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500">Valor Exato</label>
            <input name="valor_gatilho" value={formData.valor_gatilho || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" placeholder="Ex: inbound" />
          </div>
        </div>
      </div>

      {/* DESTINATÁRIOS */}
      <div className="border-t pt-4">
        <label className="block text-sm font-bold text-gray-700 mb-2">Quem deve receber?</label>
        
        {/* BOTÃO DE PUSH MOBILE */}
        <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full text-blue-600">
               <FontAwesomeIcon icon={faMobileAlt} />
            </div>
            <div>
               <p className="text-sm font-bold text-blue-900">Enviar Push Notification</p>
               <p className="text-xs text-blue-700">Tocar no celular mesmo com app fechado</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="enviar_push" checked={formData.enviar_push} onChange={handleChange} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 mb-1">Cargos</label>
              <select multiple name="funcoes_ids" value={formData.funcoes_ids || []} onChange={handleMultiSelect} className="w-full p-2 border rounded-md text-sm h-24">
                {funcoes.map(f => <option key={f.id} value={f.id}>{f.nome_funcao}</option>)}
              </select>
            </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="border-t pt-4 space-y-3">
        <div>
          <label className="block text-xs font-bold text-gray-500">Título</label>
          <input required name="titulo_template" value={formData.titulo_template} onChange={handleChange} className="w-full p-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500">Mensagem</label>
          <textarea required name="mensagem_template" value={formData.mensagem_template} onChange={handleChange} rows="2" className="w-full p-2 border rounded-md" />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <button type="submit" disabled={isSaving} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
          {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
          Salvar
        </button>
      </div>
    </form>
  );
}