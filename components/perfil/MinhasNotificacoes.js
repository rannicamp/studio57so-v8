"use client";

import { useState, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faSpinner, faLayerGroup } from '@fortawesome/free-solid-svg-icons';

export default function MinhasNotificacoes() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // 1. Busca todas as regras de notificação da empresa (Apenas as ativas)
  const { data: regras = [], isLoading: loadingRegras } = useQuery({
    queryKey: ['regras_disponiveis'],
    queryFn: async () => {
      const { data } = await supabase.from('regras_notificacao').select('*').eq('ativo', true);
      return data || [];
    }
  });

  // 2. Busca os nomes amigáveis das tabelas (Para exibir "Financeiro" em vez de "lancamentos")
  const { data: tabelasSistema = [] } = useQuery({
    queryKey: ['tabelas_sistema_nomes'],
    queryFn: async () => {
      const { data } = await supabase.from('tabelas_sistema').select('nome_tabela, nome_exibicao');
      return data || [];
    }
  });

  // 3. Busca as preferências JÁ SALVAS do usuário
  const { data: preferencias = [], isLoading: loadingPrefs } = useQuery({
    queryKey: ['minhas_preferencias'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data } = await supabase
        .from('usuario_preferencias_notificacao')
        .select('*')
        .eq('usuario_id', user.id);
      return data || [];
    }
  });

  // 4. Mutation para salvar a escolha (Liga/Desliga)
  const togglePreference = useMutation({
    mutationFn: async ({ regraId, novoStatus }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Verifica se já existe o registro para fazer update ou insert
      const existe = preferencias.find(p => p.regra_id === regraId);

      if (existe) {
        await supabase
          .from('usuario_preferencias_notificacao')
          .update({ ativo: novoStatus, updated_at: new Date() })
          .eq('id', existe.id);
      } else {
        await supabase
          .from('usuario_preferencias_notificacao')
          .insert({
            usuario_id: user.id,
            regra_id: regraId,
            ativo: novoStatus,
            organizacao_id: regras[0]?.organizacao_id // Pega contexto da regra
          });
      }
    },
    onMutate: async ({ regraId, novoStatus }) => {
      // Optimistic Update (Atualiza a tela instantaneamente)
      await queryClient.cancelQueries(['minhas_preferencias']);
      const previousPrefs = queryClient.getQueryData(['minhas_preferencias']);

      queryClient.setQueryData(['minhas_preferencias'], (old) => {
        const exists = old?.find(p => p.regra_id === regraId);
        if (exists) {
          return old.map(p => p.regra_id === regraId ? { ...p, ativo: novoStatus } : p);
        } else {
          return [...(old || []), { regra_id: regraId, ativo: novoStatus, mock: true }];
        }
      });

      return { previousPrefs };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['minhas_preferencias'], context.previousPrefs);
      toast.error("Erro ao salvar preferência.");
    },
    onSettled: () => {
      queryClient.invalidateQueries(['minhas_preferencias']);
    }
  });

  // Agrupa regras usando o Nome de Exibição da tabela
  const regrasAgrupadas = useMemo(() => {
    const grupos = {};
    
    regras.forEach(regra => {
      // Tenta encontrar o metadado da tabela
      const infoTabela = tabelasSistema.find(t => t.nome_tabela === regra.tabela_alvo);
      
      // Define o nome do grupo (Prioridade: Nome Exibição > Mapeamento Manual > Nome Técnico)
      let nomeGrupo = infoTabela ? infoTabela.nome_exibicao : null;

      if (!nomeGrupo) {
        // Fallback manual para tabelas comuns caso não estejam no tabelas_sistema
        const mapaManual = {
            'lancamentos': 'Financeiro',
            'contatos': 'CRM & Clientes',
            'atividades': 'Agenda & Tarefas',
            'ocorrencias': 'Obras & Ocorrências',
            'pedidos_compra': 'Compras & Suprimentos',
            'contratos': 'Vendas & Contratos'
        };
        nomeGrupo = mapaManual[regra.tabela_alvo] || (regra.tabela_alvo.charAt(0).toUpperCase() + regra.tabela_alvo.slice(1));
      }

      if (!grupos[nomeGrupo]) grupos[nomeGrupo] = [];
      grupos[nomeGrupo].push(regra);
    });
    
    // Ordena as chaves dos grupos alfabeticamente
    return Object.keys(grupos).sort().reduce((obj, key) => { 
        obj[key] = grupos[key]; 
        return obj;
    }, {});
  }, [regras, tabelasSistema]);

  if (loadingRegras || loadingPrefs) return (
    <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
        <FontAwesomeIcon icon={faSpinner} spin className="text-2xl" /> 
        <span className="text-sm">Carregando preferências...</span>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-fade-in">
      <div className="mb-8 border-b pb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FontAwesomeIcon icon={faBell} className="text-blue-600" />
          Central de Notificações
        </h2>
        <p className="text-sm text-gray-500 mt-1">
            Personalize quais alertas você deseja receber neste dispositivo.
        </p>
      </div>

      {regras.length === 0 ? (
        <div className="text-center text-gray-400 py-12 italic bg-gray-50 rounded-lg border border-dashed border-gray-200">
            Nenhuma regra de notificação configurada pelo administrador ainda.
        </div>
      ) : (
        <div className="space-y-10">
            {Object.keys(regrasAgrupadas).map((grupo) => (
            <div key={grupo} className="animate-fade-in">
                <div className="flex items-center gap-2 mb-4">
                    <div className="bg-gray-100 p-1.5 rounded text-gray-500 text-xs">
                        <FontAwesomeIcon icon={faLayerGroup} />
                    </div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                        {grupo}
                    </h3>
                    <div className="h-px bg-gray-100 flex-grow ml-2"></div>
                </div>

                <div className="grid gap-3">
                {regrasAgrupadas[grupo].map((regra) => {
                    // Se não tiver preferência salva, o padrão é TRUE (Ativo)
                    const pref = preferencias.find(p => p.regra_id === regra.id);
                    const isAtivo = pref ? pref.ativo : true; 

                    return (
                    <div key={regra.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${isAtivo ? 'bg-white border-blue-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-75'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors ${isAtivo ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                                {/* Tenta usar o ícone da regra, se falhar usa sino */}
                                <i className={`fa-solid ${regra.icone || 'fa-bell'}`}></i>
                            </div>
                            <div>
                                <p className={`font-bold text-sm ${isAtivo ? 'text-gray-800' : 'text-gray-500'}`}>
                                    {regra.nome_regra}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                        {regra.evento === 'INSERT' ? 'Nova Criação' : regra.evento === 'UPDATE' ? 'Atualização' : 'Exclusão'}
                                    </span>
                                    {regra.enviar_push && (
                                        <span className="text-[10px] text-blue-400 flex items-center gap-1">
                                            Push Mobile
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={isAtivo}
                                onChange={(e) => togglePreference.mutate({ regraId: regra.id, novoStatus: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    );
                })}
                </div>
            </div>
            ))}
        </div>
      )}
    </div>
  );
}