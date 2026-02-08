"use client";

import { useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, faEdit, faTrash, faBolt, faSpinner, faMobileAlt, faSync,
  faTable, faCopy, faRobot
} from '@fortawesome/free-solid-svg-icons';
import RegraForm from './RegraForm';
import { renderIcon } from './constants';
// Importação do hook de persistência
import { usePersistentState } from '@/hooks/usePersistentState';

export default function GerenciadorNotificacoes() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // SUBSTITUÍDO useState POR usePersistentState
  // Isso lembra se você estava na tela de edição ou na lista
  const [isEditing, setIsEditing] = usePersistentState('notif_isEditing', false);
  const [editingRule, setEditingRule] = usePersistentState('notif_editingRule', null);

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

  // 5. BUSCA VARIÁVEIS VIRTUAIS (LINKS)
  const { data: variaveisVirtuais = [] } = useQuery({
    queryKey: ['variaveis_virtuais'],
    queryFn: async () => {
        try {
            const { data, error } = await supabase.from('variaveis_virtuais').select('*');
            if (error) return [];
            return data;
        } catch (e) {
            return [];
        }
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

  const handleEdit = (regra) => { 
      setEditingRule(regra); 
      setIsEditing(true); 
  };
  
  const handleDuplicate = (regra) => {
    const { id, created_at, organizacao_id, ...copia } = regra;
    const regraDuplicada = { ...copia, nome_regra: `${copia.nome_regra} (Cópia)` };
    setEditingRule(regraDuplicada);
    setIsEditing(true);
    toast.info("Regra duplicada. Ajuste o detalhe e salve.");
  };

  const handleNew = () => { 
      setEditingRule(null); 
      setIsEditing(true); 
  };

  // Reseta o estado persistente ao cancelar/salvar
  const resetForm = () => { 
      setIsEditing(false); 
      setEditingRule(null); 
      // Limpa o form específico também (via sessionStorage ou deixando o componente desmontar e o próximo montar limpo se usarmos chave única)
      localStorage.removeItem('notif_formData'); 
  };

  const openAIAgent = () => {
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
          variaveisVirtuais={variaveisVirtuais}
          onSubmit={(dados) => salvarRegraMutation.mutate(dados)} 
          isSaving={salvarRegraMutation.isPending}
          onCancel={resetForm}
       />
    </div>
  );
}