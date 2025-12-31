"use client";

import { useState, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, faEdit, faTrash, faBolt, faSave, faSpinner, faArrowDown, faMobileAlt, faSync,
  faBell, faMoneyBillWave, faUserPlus, faCheckCircle, 
  faExclamationTriangle, faBirthdayCake, faFileContract, faBriefcase, faBullhorn, faDatabase, faTable, faColumns,
  faCopy, faRobot // <--- Ícone do Robô importado
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp as faWhatsappBrand } from '@fortawesome/free-brands-svg-icons';

// Mapa de ícones
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
  { icon: faBolt, name: 'fa-bolt', label: 'Ação' },
  { icon: faDatabase, name: 'fa-database', label: 'Sistema' },
];

const renderIcon = (iconName, className = "") => {
  const found = AVAILABLE_ICONS.find(i => i.name === iconName);
  return <FontAwesomeIcon icon={found ? found.icon : faBell} className={className} />;
};

export default function GerenciadorNotificacoes() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // 1. BUSCA REGRAS
  const { data: regras = [], isLoading } = useQuery({
    queryKey: ['regras_notificacao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regras_notificacao').select('*').order('tabela_alvo', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  // 2. BUSCA TABELAS DO SISTEMA
  const { data: tabelasSistema = [], isLoading: isLoadingTables } = useQuery({
    queryKey: ['tabelas_sistema'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tabelas_sistema').select('*').eq('ativo', true).order('nome_exibicao');
      if (error) throw error;
      return data;
    }
  });

  // 3. BUSCA CAMPOS (COLUNAS) DO SISTEMA
  const { data: camposSistema = [] } = useQuery({
    queryKey: ['campos_sistema'],
    queryFn: async () => {
      const { data, error } = await supabase.from('campos_sistema').select('*').eq('visivel_filtro', true);
      if (error) throw error;
      return data;
    }
  });

  // 4. BUSCA CARGOS
  const { data: funcoes = [] } = useQuery({
    queryKey: ['funcoes_sistema'],
    queryFn: async () => {
      const { data } = await supabase.from('funcoes').select('id, nome_funcao');
      return data || [];
    }
  });

  // Agrupamento para a Lista
  const regrasAgrupadas = useMemo(() => {
    const grupos = {};
    regras.forEach(regra => {
      const infoTabela = tabelasSistema.find(t => t.nome_tabela === regra.tabela_alvo);
      const nomeGrupo = infoTabela ? infoTabela.nome_exibicao : (regra.tabela_alvo || 'Outros');
      
      if (!grupos[nomeGrupo]) grupos[nomeGrupo] = [];
      grupos[nomeGrupo].push(regra);
    });
    return grupos;
  }, [regras, tabelasSistema]);

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
      toast.success(editingRule?.id ? "Regra atualizada!" : "Regra criada!");
      resetForm();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await supabase.from('regras_notificacao').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['regras_notificacao']);
      toast.success("Regra excluída.");
    }
  });

  const syncTablesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('sincronizar_tabelas_do_banco');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tabelas_sistema']);
      queryClient.invalidateQueries(['campos_sistema']);
      toast.success("Catálogo de dados atualizado!");
    },
    onError: () => toast.error("Erro ao sincronizar tabelas.")
  });

  const handleEdit = (regra) => { setEditingRule(regra); setIsEditing(true); };
  
  const handleDuplicate = (regra) => {
    const { id, created_at, organizacao_id, ...copia } = regra;
    const regraDuplicada = { ...copia, nome_regra: `${copia.nome_regra} (Cópia)` };
    setEditingRule(regraDuplicada);
    setIsEditing(true);
    toast.info("Regra duplicada. Ajuste o detalhe e salve.");
  };

  const handleNew = () => { setEditingRule(null); setIsEditing(true); };
  const resetForm = () => { setIsEditing(false); setEditingRule(null); };

  // --- AQUI ESTÁ O LINK PARA O SEU AGENTE PERSONALIZADO ---
  const openAIAgent = () => {
    // Abre o link do seu Gem específico em uma nova aba
    window.open('https://gemini.google.com/gem/1UdcyjP0rRxdtbOjOXbrIYR06nJZnTtGC?usp=sharing', '_blank');
  };

  if (!isEditing) {
    return (
      <div className="space-y-6 h-full flex flex-col p-6 max-w-5xl mx-auto">
        <div className="flex justify-between items-center pb-4 border-b">
          <div>
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FontAwesomeIcon icon={faBolt} className="text-yellow-500" />
              Regras de Notificação
            </h3>
            <p className="text-xs text-gray-500 mt-1">Gerencie os alertas automáticos do sistema.</p>
          </div>
          <div className="flex gap-2">
             {/* BOTÃO DE AJUDA IA */}
            <button onClick={openAIAgent} className="bg-purple-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-purple-700 flex items-center gap-2 shadow-sm transition-all border border-purple-500" title="Pedir ajuda ao Agente de Notificações">
               <FontAwesomeIcon icon={faRobot} /> Ajuda com IA
            </button>

            <button onClick={() => syncTablesMutation.mutate()} className="text-gray-500 hover:text-blue-600 px-3 py-2 rounded-lg text-xs font-bold border border-transparent hover:border-blue-100 flex items-center gap-2 transition-all" title="Buscar novas tabelas e campos do banco">
               <FontAwesomeIcon icon={faSync} spin={syncTablesMutation.isPending} /> 
               {syncTablesMutation.isPending ? 'Sincronizando...' : 'Atualizar Dados'}
            </button>
            <button onClick={handleNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-all">
              <FontAwesomeIcon icon={faPlus} /> Nova Regra
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-8">
          {isLoading ? (
            <div className="text-center text-gray-400 py-12"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
          ) : regras.length === 0 ? (
            <div className="text-center text-gray-400 py-12 border-2 border-dashed rounded-xl bg-gray-50">
              <p className="text-sm">Nenhuma regra ativa.</p>
            </div>
          ) : (
            Object.keys(regrasAgrupadas).map((grupo) => (
              <div key={grupo} className="animate-fade-in">
                <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="bg-blue-50 p-1.5 rounded text-blue-600">
                        <FontAwesomeIcon icon={faTable} className="text-xs" />
                    </div>
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                        {grupo}
                    </h4>
                    <div className="h-px bg-gray-200 flex-grow ml-2"></div>
                </div>

                <div className="grid gap-3">
                    {regrasAgrupadas[grupo].map((regra) => (
                    <div key={regra.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex justify-between items-center group">
                        <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl ${regra.ativo ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            {renderIcon(regra.icone)}
                        </div>
                        
                        <div>
                            <h4 className={`font-bold text-sm ${regra.ativo ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                            {regra.nome_regra}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${regra.evento === 'INSERT' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                                {regra.evento}
                            </span>
                            
                            {regra.coluna_monitorada && (
                                <span className="text-[10px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-100 font-mono">
                                    se {regra.coluna_monitorada} == {regra.valor_gatilho}
                                </span>
                            )}
                            
                            {regra.enviar_push && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 ml-1">
                                <FontAwesomeIcon icon={faMobileAlt} />
                                </span>
                            )}
                            </div>
                        </div>
                        </div>

                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleDuplicate(regra)} title="Duplicar Regra" className="text-gray-400 hover:text-green-600 p-2 hover:bg-green-50 rounded-lg transition-colors">
                            <FontAwesomeIcon icon={faCopy} />
                        </button>
                        
                        <button onClick={() => handleEdit(regra)} title="Editar" className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors">
                            <FontAwesomeIcon icon={faEdit} />
                        </button>
                        
                        <button onClick={() => { if(confirm('Excluir regra?')) deleteMutation.mutate(regra.id); }} title="Excluir" className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors">
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                        </div>
                    </div>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
       <RegraForm 
          initialData={editingRule} 
          tabelas={tabelasSistema} 
          campos={camposSistema} 
          funcoes={funcoes} 
          onSubmit={(dados) => salvarRegraMutation.mutate(dados)} 
          isSaving={salvarRegraMutation.isPending}
          onCancel={resetForm}
       />
    </div>
  );
}

// O componente RegraForm permanece (sem a lógica de API interna que eu tinha sugerido antes)
function RegraForm({ initialData, tabelas, campos, funcoes, onSubmit, isSaving, onCancel }) {
  const [formData, setFormData] = useState(initialData || {
    nome_regra: '', tabela_alvo: '', evento: 'INSERT',
    coluna_monitorada: '', valor_gatilho: '',
    funcoes_ids: [], enviar_para_dono: false, enviar_push: true,
    titulo_template: 'Nova notificação', mensagem_template: '{conteudo}', link_template: '/', 
    ativo: true, icone: 'fa-bell'
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleMultiSelect = (e) => {
    const options = Array.from(e.target.selectedOptions, option => parseInt(option.value));
    setFormData(prev => ({ ...prev, funcoes_ids: options }));
  };

  const colunasFiltradas = useMemo(() => {
    if (!formData.tabela_alvo || !tabelas || !campos) return [];
    const tabelaObj = tabelas.find(t => t.nome_tabela === formData.tabela_alvo);
    if (!tabelaObj) return [];
    return campos.filter(c => c.tabela_id === tabelaObj.id);
  }, [formData.tabela_alvo, tabelas, campos]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <h3 className="text-lg font-bold text-gray-800">
          {initialData?.id ? 'Editar Regra' : initialData ? 'Nova Regra (Cópia)' : 'Nova Regra de Notificação'}
        </h3>
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-800 hover:underline">
          Voltar para lista
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
           <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Identidade</label>
              <input required name="nome_regra" value={formData.nome_regra} onChange={handleChange} className="w-full p-2.5 border rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none mb-4" placeholder="Nome da Regra" />
              <div className="grid grid-cols-5 gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                {AVAILABLE_ICONS.map((item) => (
                    <button key={item.name} type="button" onClick={() => setFormData(prev => ({ ...prev, icone: item.name }))} className={`aspect-square rounded-md flex items-center justify-center text-lg transition-all ${formData.icone === item.name ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-200' : 'text-gray-400 hover:bg-gray-200'}`} title={item.label}>
                        <FontAwesomeIcon icon={item.icon} />
                    </button>
                ))}
              </div>
           </div>
        </div>

        <div className="md:col-span-2 space-y-4">
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100 rounded-bl-full -mr-8 -mt-8"></div>
                <h4 className="text-xs font-bold text-blue-800 uppercase mb-4 flex items-center gap-2">
                    <span className="bg-blue-200 px-2 py-0.5 rounded text-[10px]">1</span> Onde (Gatilho)
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-blue-600 mb-1 uppercase">Módulo / Tabela</label>
                        <select required name="tabela_alvo" value={formData.tabela_alvo} onChange={handleChange} className="w-full p-2 border border-blue-200 rounded-lg text-sm bg-white">
                            <option value="">Selecione...</option>
                            {tabelas && tabelas.map(t => <option key={t.id} value={t.nome_tabela}>{t.nome_exibicao} ({t.modulo})</option>)}
                            <option value="activities">Atividades (Manual)</option>
                            <option value="whatsapp_messages">WhatsApp (Manual)</option>
                            <option value="produtos_empreendimento">Produtos (Manual)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-blue-600 mb-1 uppercase">Evento</label>
                        <select name="evento" value={formData.evento} onChange={handleChange} className="w-full p-2 border border-blue-200 rounded-lg text-sm bg-white">
                            <option value="INSERT">Ao Criar</option>
                            <option value="UPDATE">Ao Atualizar</option>
                            <option value="DELETE">Ao Excluir</option>
                        </select>
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-blue-200/50">
                    <p className="text-[10px] font-bold text-blue-400 mb-2 uppercase">Filtro (Opcional)</p>
                    <div className="flex gap-2">
                        {colunasFiltradas.length > 0 ? (
                            <div className="w-1/2 relative">
                                <select name="coluna_monitorada" value={formData.coluna_monitorada || ''} onChange={handleChange} className="w-full p-2 border border-blue-200 rounded-lg text-xs bg-white appearance-none">
                                    <option value="">-- Qualquer Coluna --</option>
                                    {colunasFiltradas.map(c => <option key={c.id} value={c.nome_coluna}>{c.nome_exibicao}</option>)}
                                </select>
                                <div className="absolute right-2 top-2.5 text-blue-300 pointer-events-none text-xs"><FontAwesomeIcon icon={faColumns} /></div>
                            </div>
                        ) : (
                            <input name="coluna_monitorada" value={formData.coluna_monitorada || ''} onChange={handleChange} className="w-1/2 p-2 border border-blue-200 rounded-lg text-xs" placeholder="Coluna (ex: status)" />
                        )}
                        <div className="flex items-center text-blue-300 font-bold">=</div>
                        <input name="valor_gatilho" value={formData.valor_gatilho || ''} onChange={handleChange} className="w-1/2 p-2 border border-blue-200 rounded-lg text-xs" placeholder="Valor (ex: Concluído)" />
                    </div>
                </div>
            </div>

            <div className="flex justify-center -my-2 relative z-10">
                <div className="bg-white border rounded-full p-1 text-gray-300 shadow-sm"><FontAwesomeIcon icon={faArrowDown} /></div>
            </div>

            <div className="bg-orange-50 p-5 rounded-xl border border-orange-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-orange-100 rounded-bl-full -mr-8 -mt-8"></div>
                <h4 className="text-xs font-bold text-orange-800 uppercase mb-4 flex items-center gap-2">
                    <span className="bg-orange-200 px-2 py-0.5 rounded text-[10px]">2</span> Ação (Notificar)
                </h4>

                <div className="mb-4">
                    <label className="block text-[10px] font-bold text-orange-600 mb-1 uppercase">Quem recebe?</label>
                    <div className="flex gap-3">
                        <select multiple name="funcoes_ids" value={formData.funcoes_ids || []} onChange={handleMultiSelect} className="flex-1 p-2 border border-orange-200 rounded-lg text-sm h-20 bg-white">
                            {funcoes.map(f => <option key={f.id} value={f.id}>{f.nome_funcao}</option>)}
                        </select>
                        <div className="w-1/3 flex flex-col gap-2">
                             <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-orange-200 hover:bg-orange-100/50 transition-colors h-full">
                                <input type="checkbox" name="enviar_para_dono" checked={formData.enviar_para_dono} onChange={handleChange} className="text-orange-500 rounded" />
                                <span className="text-xs font-bold text-gray-600">Dono</span>
                             </label>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <input required name="titulo_template" value={formData.titulo_template} onChange={handleChange} className="w-full p-2 border border-orange-200 rounded-lg text-sm font-bold placeholder-orange-300" placeholder="Título" />
                    <textarea required name="mensagem_template" value={formData.mensagem_template} onChange={handleChange} rows="2" className="w-full p-2 border border-orange-200 rounded-lg text-sm placeholder-orange-300" placeholder="Mensagem..." />
                    <p className="text-[10px] text-gray-400">Dica do Agente: Use {'{nome_empreendimento}'}, {'{nome_contato}'}, {'{unidade}'}. Se tiver dúvida, clique no botão de Ajuda!</p>
                </div>

                 <div className="mt-4 pt-3 border-t border-orange-200/50 flex justify-between items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <div className={`w-8 h-4 rounded-full transition-colors relative ${formData.enviar_push ? 'bg-green-500' : 'bg-gray-300'}`}>
                             <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${formData.enviar_push ? 'left-4.5' : 'left-0.5'}`}></div>
                        </div>
                        <input type="checkbox" name="enviar_push" checked={formData.enviar_push} onChange={handleChange} className="sr-only" />
                        <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                            <FontAwesomeIcon icon={faMobileAlt} /> Push
                        </span>
                    </label>
                    <input name="link_template" value={formData.link_template || ''} onChange={handleChange} className="w-1/2 p-1.5 border border-orange-200 rounded text-xs bg-white text-right" placeholder="Link (opcional)" />
                </div>
            </div>

        </div>
      </div>

      <div className="pt-6 border-t flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            Cancelar
        </button>
        <button type="button" onClick={() => onSubmit(formData)} disabled={isSaving || !formData.nome_regra || !formData.tabela_alvo} className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-50 transition-all transform active:scale-95">
            {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
            Salvar
        </button>
      </div>
    </div>
  );
}