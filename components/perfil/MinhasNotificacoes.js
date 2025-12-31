"use client";

import { useState, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faSpinner, faLayerGroup, faMobileScreen, faDesktop } from '@fortawesome/free-solid-svg-icons';

export default function MinhasNotificacoes() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // 1. Busca regras ativas
  const { data: regras = [], isLoading: loadingRegras } = useQuery({
    queryKey: ['regras_disponiveis'],
    queryFn: async () => {
      const { data } = await supabase.from('regras_notificacao').select('*').eq('ativo', true).order('nome_regra');
      return data || [];
    }
  });

  // 2. Busca nomes das tabelas
  const { data: tabelasSistema = [] } = useQuery({
    queryKey: ['tabelas_sistema_nomes'],
    queryFn: async () => {
      const { data } = await supabase.from('tabelas_sistema').select('nome_tabela, nome_exibicao');
      return data || [];
    }
  });

  // 3. Busca preferências salvas
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

  // 4. Mutation CORRIGIDA (Usa Upsert)
  const toggleChannel = useMutation({
    mutationFn: async ({ regraId, canal, novoStatus }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Verifica o estado atual local para garantir que enviamos todos os campos
      // Caso o registro não exista ainda no banco, assumimos TRUE para o outro canal
      const atual = preferencias.find(p => p.regra_id === regraId);
      
      const payload = {
        usuario_id: user.id,
        regra_id: regraId,
        organizacao_id: regras.find(r => r.id === regraId)?.organizacao_id,
        ativo: true, // Mantém o registro "mãe" ativo
        // Se já existe, mantém o valor do banco. Se não, começa True.
        canal_sistema: atual ? atual.canal_sistema : true,
        canal_push: atual ? atual.canal_push : true
      };

      // Sobrescreve apenas o canal que estamos clicando agora
      payload[canal] = novoStatus;
      payload.updated_at = new Date();

      // UPSERT MÁGICO: Cria ou Atualiza baseado no (usuario_id, regra_id)
      const { error } = await supabase
        .from('usuario_preferencias_notificacao')
        .upsert(payload, { onConflict: 'usuario_id, regra_id' });

      if (error) throw error;
    },
    onMutate: async ({ regraId, canal, novoStatus }) => {
      // Optimistic Update (Atualiza visualmente na hora)
      await queryClient.cancelQueries(['minhas_preferencias']);
      const previousPrefs = queryClient.getQueryData(['minhas_preferencias']);

      queryClient.setQueryData(['minhas_preferencias'], (old) => {
        const exists = old?.find(p => p.regra_id === regraId);
        if (exists) {
            // Atualiza localmente
          return old.map(p => p.regra_id === regraId ? { ...p, [canal]: novoStatus } : p);
        } else {
            // Cria localmente
          return [...(old || []), { 
            regra_id: regraId, 
            [canal]: novoStatus, 
            // Mock dos outros valores
            canal_sistema: canal === 'canal_sistema' ? novoStatus : true,
            canal_push: canal === 'canal_push' ? novoStatus : true,
            mock: true 
          }];
        }
      });

      return { previousPrefs };
    },
    onError: (err, newTodo, context) => {
      console.error("Erro ao salvar notificação:", err);
      // Se der erro, volta ao estado anterior
      queryClient.setQueryData(['minhas_preferencias'], context.previousPrefs);
      toast.error("Não foi possível salvar a preferência.");
    },
    onSettled: () => {
      // Sincroniza com o servidor para ter certeza
      queryClient.invalidateQueries(['minhas_preferencias']);
    }
  });

  // Lógica de Agrupamento
  const regrasAgrupadas = useMemo(() => {
    const grupos = {};
    regras.forEach(regra => {
      const infoTabela = tabelasSistema.find(t => t.nome_tabela === regra.tabela_alvo);
      let nomeGrupo = infoTabela ? infoTabela.nome_exibicao : null;
      
      if (!nomeGrupo) {
        const mapaManual = {
            'lancamentos': 'Financeiro',
            'contatos': 'CRM & Clientes',
            'atividades': 'Agenda & Tarefas',
            'ocorrencias': 'Obras & Ocorrências',
            'pedidos_compra': 'Compras & Suprimentos',
            'contratos': 'Vendas & Contratos',
            'funcionarios': 'RH & Pessoal'
        };
        nomeGrupo = mapaManual[regra.tabela_alvo] || (regra.tabela_alvo.charAt(0).toUpperCase() + regra.tabela_alvo.slice(1));
      }

      if (!grupos[nomeGrupo]) grupos[nomeGrupo] = [];
      grupos[nomeGrupo].push(regra);
    });
    
    return Object.keys(grupos).sort().reduce((obj, key) => { 
        obj[key] = grupos[key]; 
        return obj;
    }, {});
  }, [regras, tabelasSistema]);

  // Componente Switch
  const ToggleSwitch = ({ label, icon, active, onChange, disabled = false }) => (
    <div className={`flex flex-col items-center gap-2 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
        <label className={`relative inline-flex items-center ${!disabled ? 'cursor-pointer' : ''}`}>
            <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={active}
                onChange={(e) => !disabled && onChange(e.target.checked)}
                disabled={disabled}
            />
            <div className={`w-11 h-6 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-100 
                after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white 
                after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 
                after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white
                ${active ? 'bg-green-500' : 'bg-red-500'}
            `}></div>
        </label>
        <span className={`text-[10px] font-medium flex items-center gap-1 ${active ? 'text-green-700' : 'text-gray-400'}`}>
            <FontAwesomeIcon icon={icon} />
            {label}
        </span>
    </div>
  );

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
            Central de Regras e Alertas
        </h2>
        <p className="text-sm text-gray-500 mt-1">
            <span className="text-green-600 font-bold">Verde</span> = Receber | <span className="text-red-500 font-bold">Vermelho</span> = Não Receber
        </p>
      </div>

      {regras.length === 0 ? (
        <div className="text-center text-gray-400 py-12 italic bg-gray-50 rounded-lg border border-dashed border-gray-200">
            Nenhuma regra de notificação configurada.
        </div>
      ) : (
        <div className="space-y-8">
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
                    const pref = preferencias.find(p => p.regra_id === regra.id);
                    // Se não existir preferência, o padrão é TRUE (ligado)
                    const webAtivo = pref ? pref.canal_sistema : true; 
                    const pushAtivo = pref ? pref.canal_push : true;
                    const permitePush = regra.enviar_push;

                    return (
                    <div key={regra.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:border-blue-100 transition-all shadow-sm">
                        
                        {/* Info Regra */}
                        <div className="flex items-center gap-4 flex-1 pr-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-blue-50 text-blue-600">
                                <i className={`fa-solid ${regra.icone || 'fa-bell'}`}></i>
                            </div>
                            <div>
                                <p className="font-bold text-sm text-gray-800 leading-tight">
                                    {regra.nome_regra}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                        {regra.evento === 'INSERT' ? 'Nova Criação' : regra.evento === 'UPDATE' ? 'Edição' : 'Exclusão'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Interruptores */}
                        <div className="flex items-center gap-6 border-l pl-6 border-gray-100">
                            <ToggleSwitch 
                                label="Web" 
                                icon={faDesktop}
                                active={webAtivo} 
                                onChange={(val) => toggleChannel.mutate({ regraId: regra.id, canal: 'canal_sistema', novoStatus: val })}
                            />
                            
                            <ToggleSwitch 
                                label="Celular" 
                                icon={faMobileScreen}
                                active={pushAtivo}
                                disabled={!permitePush}
                                onChange={(val) => toggleChannel.mutate({ regraId: regra.id, canal: 'canal_push', novoStatus: val })}
                            />
                        </div>

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