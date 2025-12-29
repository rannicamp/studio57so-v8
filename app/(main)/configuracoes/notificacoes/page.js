"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, faEdit, faTrash, faBolt, faToggleOn, faToggleOff, 
  faSpinner, faInfoCircle, faUsers, faUserTag, faSave 
} from '@fortawesome/free-solid-svg-icons';

// Componente de Modal Simples
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

  // --- BUSCA DE DADOS ---
  
  // 1. Busca Regras Existentes
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

  // 2. Busca Cargos (Funções) para o Select
  const { data: funcoes = [] } = useQuery({
    queryKey: ['funcoes_sistema'],
    queryFn: async () => {
      const { data } = await supabase.from('funcoes').select('id, nome_funcao');
      return data || [];
    }
  });

  // --- AÇÕES (MUTATIONS) ---

  const salvarRegraMutation = useMutation({
    mutationFn: async (dados) => {
      // Pega organização do usuário atual para garantir segurança
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userData } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
      
      // --- CORREÇÃO AQUI ---
      // Removemos o 'id' dos dados para não tentar atualizar a coluna de identidade
      const { id, ...dadosLimpos } = dados;

      const payload = { ...dadosLimpos, organizacao_id: userData.organizacao_id };

      if (editingRule?.id) {
        // No update, usamos os dados limpos (sem id no corpo, apenas no filtro .eq)
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
    onSuccess: () => {
      queryClient.invalidateQueries(['regras_notificacao']);
      toast.success("Status atualizado.");
    }
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

  // --- FORMULÁRIO ---
  const handleEdit = (regra) => {
    setEditingRule(regra);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingRule(null);
    setIsModalOpen(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-gray-900 to-gray-800 p-8 rounded-2xl text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FontAwesomeIcon icon={faBolt} className="text-yellow-400" />
            Automação de Notificações
          </h1>
          <p className="text-gray-300 mt-2 max-w-2xl">
            Crie regras inteligentes. Quando algo acontecer no banco de dados, o sistema avisa a equipe certa automaticamente.
          </p>
        </div>
        <button 
          onClick={handleNew}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition-all transform hover:scale-105 flex items-center gap-2 whitespace-nowrap"
        >
          <FontAwesomeIcon icon={faPlus} /> Nova Regra
        </button>
      </div>

      {/* LISTAGEM */}
      {isLoading ? (
        <div className="flex justify-center p-12 text-gray-400">
          <FontAwesomeIcon icon={faSpinner} spin size="3x" />
        </div>
      ) : regras.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500 text-lg">Nenhuma regra ativa.</p>
          <button onClick={handleNew} className="text-blue-600 font-bold hover:underline mt-2">Criar a primeira regra</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {regras.map((regra) => (
            <div key={regra.id} className={`bg-white p-5 rounded-xl shadow-sm border transition-all hover:shadow-md ${!regra.ativo ? 'opacity-60 grayscale' : 'border-gray-100'}`}>
              <div className="flex justify-between items-start">
                
                {/* Info Principal */}
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${regra.evento === 'UPDATE' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                    <strong className="text-xs uppercase tracking-wider">{regra.evento}</strong>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{regra.nome_regra}</h3>
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                      <span className="font-mono bg-gray-100 px-1 rounded text-gray-700">{regra.tabela_alvo}</span>
                      {regra.coluna_monitorada && (
                        <>
                          <span>quando</span>
                          <span className="font-mono bg-yellow-50 text-yellow-700 px-1 rounded">{regra.coluna_monitorada}</span>
                          <span>vira</span>
                          <span className="font-bold text-gray-800">{regra.valor_gatilho || '*Qualquer*'}</span>
                        </>
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {regra.enviar_para_dono && (
                        <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full flex items-center gap-1">
                          <FontAwesomeIcon icon={faUserTag} /> Dono
                        </span>
                      )}
                      {regra.funcoes_ids?.length > 0 && (
                        <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-full flex items-center gap-1">
                          <FontAwesomeIcon icon={faUsers} /> 
                          {regra.funcoes_ids.length} Cargos
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toggleAtivoMutation.mutate({ id: regra.id, ativo: !regra.ativo })}
                    className={`text-2xl transition-colors ${regra.ativo ? 'text-green-500 hover:text-green-600' : 'text-gray-300 hover:text-gray-400'}`}
                    title={regra.ativo ? "Desativar" : "Ativar"}
                  >
                    <FontAwesomeIcon icon={regra.ativo ? faToggleOn : faToggleOff} />
                  </button>
                  <button onClick={() => handleEdit(regra)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button 
                    onClick={() => { if(confirm('Excluir regra?')) excluirRegraMutation.mutate(regra.id); }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
              
              {/* Preview da Mensagem */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-600 italic">
                "{regra.mensagem_template}"
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE EDIÇÃO/CRIAÇÃO */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRule ? "Editar Regra" : "Nova Regra de Notificação"}>
        <RegraForm 
          initialData={editingRule} 
          funcoes={funcoes} 
          onSubmit={(dados) => salvarRegraMutation.mutate(dados)}
          isSaving={salvarRegraMutation.isPending}
        />
      </Modal>
    </div>
  );
}

// --- SUB-COMPONENTE DE FORMULÁRIO ---
function RegraForm({ initialData, funcoes, onSubmit, isSaving }) {
  const [formData, setFormData] = useState(initialData || {
    nome_regra: '',
    tabela_alvo: 'activities', // Default comum
    evento: 'UPDATE',
    coluna_monitorada: 'status',
    valor_gatilho: '',
    funcoes_ids: [],
    enviar_para_dono: true,
    titulo_template: 'Atualização: {nome}',
    mensagem_template: 'O status mudou para {status}.',
    link_template: '/atividades',
    ativo: true
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleMultiSelect = (e) => {
    const options = Array.from(e.target.selectedOptions, option => parseInt(option.value));
    setFormData(prev => ({ ...prev, funcoes_ids: options }));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-6">
      
      {/* 1. Identificação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-bold text-gray-700 mb-1">Nome da Regra</label>
          <input required name="nome_regra" value={formData.nome_regra} onChange={handleChange} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500" placeholder="Ex: Aviso de Contrato Assinado" />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Tabela Alvo (DB)</label>
          <input required name="tabela_alvo" value={formData.tabela_alvo} onChange={handleChange} className="w-full p-2 border rounded-md font-mono text-sm bg-gray-50" placeholder="Ex: activities" />
          <p className="text-[10px] text-gray-500 mt-1">Nome exato da tabela no banco.</p>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Evento</label>
          <select name="evento" value={formData.evento} onChange={handleChange} className="w-full p-2 border rounded-md">
            <option value="INSERT">Criação (INSERT)</option>
            <option value="UPDATE">Atualização (UPDATE)</option>
            <option value="DELETE">Exclusão (DELETE)</option>
          </select>
        </div>
      </div>

      {/* 2. Condições (Só se for UPDATE) */}
      {formData.evento === 'UPDATE' && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
            <FontAwesomeIcon icon={faInfoCircle} /> Gatilho de Alteração
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Coluna Monitorada</label>
              <input name="coluna_monitorada" value={formData.coluna_monitorada || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" placeholder="Ex: status" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Valor Gatilho (Opcional)</label>
              <input name="valor_gatilho" value={formData.valor_gatilho || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm" placeholder="Ex: Concluído" />
              <p className="text-[10px] text-gray-500 mt-1">Deixe vazio para disparar em qualquer mudança.</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Destinatários */}
      <div className="border-t pt-4">
        <label className="block text-sm font-bold text-gray-700 mb-2">Quem deve receber?</label>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="flex items-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
              <input type="checkbox" name="enviar_para_dono" checked={formData.enviar_para_dono} onChange={handleChange} className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Dono do Registro / Criador</span>
            </label>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-600 mb-1">Cargos/Grupos Específicos</label>
            <select multiple name="funcoes_ids" value={formData.funcoes_ids || []} onChange={handleMultiSelect} className="w-full p-2 border rounded-md text-sm h-24">
              {funcoes.map(f => (
                <option key={f.id} value={f.id}>{f.nome_funcao}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">Segure Ctrl/Cmd para selecionar vários.</p>
          </div>
        </div>
      </div>

      {/* 4. Mensagem */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-bold text-gray-700 mb-3">Conteúdo da Notificação</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-500">Título</label>
            <input required name="titulo_template" value={formData.titulo_template} onChange={handleChange} className="w-full p-2 border rounded-md" placeholder="Ex: Tarefa {id} Atualizada" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500">Mensagem</label>
            <textarea required name="mensagem_template" value={formData.mensagem_template} onChange={handleChange} rows="2" className="w-full p-2 border rounded-md" placeholder="Ex: O status mudou para {status}." />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500">Link de Destino</label>
            <input name="link_template" value={formData.link_template || ''} onChange={handleChange} className="w-full p-2 border rounded-md text-sm text-blue-600" placeholder="Ex: /atividades" />
          </div>
          <div className="bg-gray-100 p-2 rounded text-xs text-gray-500">
            <strong>Variáveis disponíveis:</strong> {'{nome}'}, {'{id}'}, {'{status}'} (serão substituídas pelos dados reais).
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-md flex items-center gap-2">
          {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
          Salvar Regra
        </button>
      </div>
    </form>
  );
}