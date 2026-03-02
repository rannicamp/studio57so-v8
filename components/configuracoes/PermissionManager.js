"use client";

import { useState, Fragment, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
// --------------------------------------------------------
// NOVAS IMPORTAÇÕES DO DEVONILDO 🧙‍♂️
// --------------------------------------------------------
import { useAuth } from '@/contexts/AuthContext'; // Para pegar o organizacao_id
import { useMutation } from '@tanstack/react-query'; // Para salvar no banco
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faTimes, faShieldAlt } from '@fortawesome/free-solid-svg-icons';

export default function PermissionManager({ initialFuncoes }) {
  const supabase = createClient();
  const { user } = useAuth(); // Pegando o usuário logado

  const [funcoes, setFuncoes] = useState(initialFuncoes);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTargetState, setDragTargetState] = useState(false);
  const pendingChanges = useRef([]);

  // Estados para o Modal de Criar Função
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFuncaoNome, setNewFuncaoNome] = useState('');
  const [newFuncaoDesc, setNewFuncaoDesc] = useState('');

  // =================================================================================
  // MUTAÇÃO PARA CRIAR NOVA FUNÇÃO (CUD usa useMutation) 🚀
  // =================================================================================
  const createFuncaoMutation = useMutation({
    mutationFn: async () => {
      if (!user?.organizacao_id) throw new Error("Organização não identificada. Recarregue a página.");
      if (!newFuncaoNome.trim()) throw new Error("O nome da função é obrigatório, seu lindo!");

      const novaFuncao = {
        nome_funcao: newFuncaoNome.trim(),
        descricao: newFuncaoDesc.trim(),
        organizacao_id: user.organizacao_id,
        // created_at é gerado automaticamente pelo banco (default now())
      };

      const { data, error } = await supabase
        .from('funcoes')
        .insert([novaFuncao])
        .select()
        .single();

      if (error) {
        // Tratando o seu índice único (idx_funcoes_organizacao_nome)
        if (error.code === '23505') {
          throw new Error("Já existe uma função com este nome na sua organização.");
        }
        throw error;
      }
      return data;
    },
    onSuccess: (novaFuncaoCriada) => {
      // Adicionamos a nova função na lista local, com as permissões zeradas
      setFuncoes([...funcoes, { ...novaFuncaoCriada, permissoes: [] }]);

      // Limpamos a casa
      setNewFuncaoNome('');
      setNewFuncaoDesc('');
      setShowAddModal(false);

      toast.success(`Função "${novaFuncaoCriada.nome_funcao}" criada com sucesso!`);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        savePendingChanges();
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // =================================================================================
  // LISTA DE RECURSOS ATUALIZADA (BLINDADA PELO DEVONILDO) 🛡️
  // =================================================================================
  const resourceGroups = [
    {
      title: 'Administrativo',
      resources: [
        { key: 'painel', name: 'Painel (Dashboard)' },
        { key: 'financeiro', name: 'Financeiro' },
        { key: 'recursos_humanos', name: 'Menu Recursos Humanos' },
        { key: 'funcionarios', name: 'Funcionários' },
        { key: 'funcionarios_salario_debug', name: 'Diagnóstico Salarial' },
        { key: 'ponto', name: 'Controle de Ponto' },
        { key: 'empresas', name: 'Empresas' },
        { key: 'empreendimentos', name: 'Empreendimentos' },
        { key: 'contratos', name: 'Contratos' },
      ]
    },
    {
      title: 'Comercial',
      resources: [
        { key: 'caixa_de_entrada', name: 'Caixa de Entrada' },
        { key: 'crm', name: 'Funil de Vendas (CRM)' },
        { key: 'tabela_vendas', name: 'Tabela de Vendas' },
        { key: 'anuncios', name: 'Anúncios (Marketing)' },
        { key: 'contatos', name: 'Contatos' },
        { key: 'simulador', name: 'Simulador' },
      ]
    },
    {
      title: 'Obra & Engenharia',
      resources: [
        { key: 'orcamento', name: 'Orçamentação' },
        { key: 'pedidos', name: 'Pedidos de Compra' },
        { key: 'almoxarifado', name: 'Almoxarifado' },
        { key: 'rdo', name: 'Diário de Obra (RDO)' },
        { key: 'atividades', name: 'Gestão de Atividades' },
      ]
    },
    {
      title: 'Coordenação BIM',
      resources: [
        { key: 'bim', name: 'BIM Manager (3D)' },
      ]
    },
    {
      title: 'Sistema',
      resources: [
        { key: 'usuarios', name: 'Usuários' },
        { key: 'permissoes', name: 'Permissões' },
      ]
    },
    {
      title: 'Configurações',
      resources: [
        { key: 'config_usuarios', name: 'Gestão de Usuários' },
        { key: 'config_permissoes', name: 'Permissões de Acesso' },
        { key: 'config_jornadas', name: 'Jornadas de Trabalho' },
        { key: 'config_tipos_documento', name: 'Tipos de Documento' },
        { key: 'config_integracoes', name: 'Integrações' },
        { key: 'config_materiais', name: 'Base de Materiais' },
        { key: 'config_treinamento_ia', name: 'Treinamento da IA' },
        { key: 'config_kpi_builder', name: 'Construtor de KPIs' },
        { key: 'config_financeiro_importar', name: 'Importação Financeira' },
        { key: 'config_menu', name: 'Personalização do Menu' },
      ]
    }
  ];

  const updateLocalPermission = (funcaoId, recursoKey, tipoPermissao, valor) => {
    setFuncoes(currentFuncoes =>
      currentFuncoes.map(funcao => {
        if (funcao.id === funcaoId) {
          const newPermissoes = [...funcao.permissoes];
          const permissaoIndex = newPermissoes.findIndex(p => p.recurso === recursoKey);

          if (permissaoIndex > -1) {
            newPermissoes[permissaoIndex] = { ...newPermissoes[permissaoIndex], [tipoPermissao]: valor };
          } else {
            newPermissoes.push({ funcao_id: funcaoId, recurso: recursoKey, [tipoPermissao]: valor });
          }
          return { ...funcao, permissoes: newPermissoes };
        }
        return funcao;
      })
    );

    const change = { funcao_id: funcaoId, recurso: recursoKey, [tipoPermissao]: valor };
    const existingChangeIndex = pendingChanges.current.findIndex(c => c.funcao_id === funcaoId && c.recurso === recursoKey);
    if (existingChangeIndex > -1) {
      pendingChanges.current[existingChangeIndex] = { ...pendingChanges.current[existingChangeIndex], ...change };
    } else {
      pendingChanges.current.push(change);
    }
  };

  const handleMouseDown = (funcaoId, recursoKey, tipoPermissao, currentValue) => {
    const funcao = funcoes.find(f => f.id === funcaoId);
    if (funcao?.nome_funcao === 'Proprietário') return;

    setIsDragging(true);
    const targetValue = !currentValue;
    setDragTargetState(targetValue);
    updateLocalPermission(funcaoId, recursoKey, tipoPermissao, targetValue);
  };

  const handleMouseEnter = (funcaoId, recursoKey, tipoPermissao) => {
    const funcao = funcoes.find(f => f.id === funcaoId);
    if (funcao?.nome_funcao === 'Proprietário') return;

    if (isDragging) {
      updateLocalPermission(funcaoId, recursoKey, tipoPermissao, dragTargetState);
    }
  };

  const savePendingChanges = () => {
    if (pendingChanges.current.length === 0) return;

    const promise = async () => {
      const { error } = await supabase
        .from('permissoes')
        .upsert(pendingChanges.current, { onConflict: 'funcao_id, recurso' });

      pendingChanges.current = [];

      if (error) {
        throw error;
      }
    };

    toast.promise(promise(), {
      loading: `Salvando ${pendingChanges.current.length} permissões...`,
      success: 'Permissões atualizadas com sucesso!',
      error: (err) => `Erro ao salvar: ${err.message}`,
    });
  };

  const getPermissao = (funcao, recursoKey, tipo) => {
    if (funcao.nome_funcao === 'Proprietário') {
      return true;
    }
    const permissao = funcao.permissoes.find(p => p.recurso === recursoKey);
    return permissao ? !!permissao[tipo] : false;
  };

  return (
    <div className="space-y-4 select-none relative">

      {/* CABEÇALHO COM O BOTÃO DE ADICIONAR E INSTRUÇÕES */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-full -mr-10 -mt-10 pointer-events-none"></div>
        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-blue-100/50 text-blue-600 p-2.5 rounded-xl shadow-inner">
              <FontAwesomeIcon icon={faShieldAlt} className="text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">Cargos e Papéis</h2>
              <p className="text-sm text-gray-500 font-medium">Defina níveis de acesso para os colaboradores do Elo 57.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-end gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:bg-blue-700 transition-all transform hover:-translate-y-0.5 active:translate-y-0 w-full md:w-auto flex justify-center items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} /> Novo Cargo
          </button>
        </div>
      </div>

      {/* MODAL PARA ADICIONAR NOVA FUNÇÃO */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100/50 flex flex-col animate-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>

              <div className="flex justify-between items-start relative z-10">
                <div>
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-3 tracking-wide">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                      <FontAwesomeIcon icon={faShieldAlt} className="text-white" />
                    </div>
                    Criar Novo Cargo
                  </h3>
                  <p className="text-blue-100 text-xs mt-1.5 font-medium ml-1">
                    Adicione um novo nível de acesso ao sistema.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl w-10 h-10 flex items-center justify-center transition-all backdrop-blur-sm shadow-sm"
                >
                  <FontAwesomeIcon icon={faTimes} className="text-lg" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 flex-1 relative bg-gray-50/30">
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative group focus-within:border-blue-200 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                  <label className="block text-[10px] font-extrabold text-gray-500 tracking-widest uppercase mb-3 text-center">Nomenclatura do Cargo</label>
                  <input
                    type="text"
                    placeholder="Ex: Gerente Administrativo"
                    value={newFuncaoNome}
                    onChange={(e) => setNewFuncaoNome(e.target.value)}
                    className="w-full text-center px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl font-bold text-gray-800 text-lg focus:bg-white outline-none transition-all placeholder-gray-300"
                    autoFocus
                  />
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative group focus-within:border-blue-200 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                  <label className="block text-[10px] font-extrabold text-gray-400 tracking-widest uppercase mb-3">Breve Descrição (Opcional)</label>
                  <textarea
                    placeholder="Ex: Acesso total ao financeiro e leitura de contratos."
                    value={newFuncaoDesc}
                    onChange={(e) => setNewFuncaoDesc(e.target.value)}
                    className="w-full p-4 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 focus:bg-white outline-none resize-none h-24 transition-all placeholder-gray-300"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-white border-t border-gray-100 flex justify-end gap-3 shrink-0 rounded-b-[2rem]">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-800 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-xl transition-all active:scale-95 shadow-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => createFuncaoMutation.mutate()}
                disabled={createFuncaoMutation.isPending || !newFuncaoNome.trim()}
                className="px-8 py-2.5 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] flex items-center gap-3 disabled:opacity-50 disabled:shadow-none transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {createFuncaoMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin className="text-lg" /> : 'Salvar Cargo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABELA DE PERMISSÕES */}
      <div className="overflow-x-auto bg-white border border-gray-100 rounded-3xl custom-scrollbar pb-4 shadow-sm relative overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="px-6 py-4 text-left text-[11px] font-extrabold text-gray-500 tracking-widest uppercase sticky left-0 bg-gray-50/90 backdrop-blur-sm z-30 shadow-[2px_0_10px_-2px_rgba(0,0,0,0.05)] border-b border-gray-200">
                Cargo / Função
              </th>
              {resourceGroups.map((group) => (
                <th key={group.title} colSpan={group.resources.length * 4} className="px-6 py-4 text-center text-[10px] font-extrabold uppercase tracking-widest border-l-2 bg-gray-50/50 text-gray-600 border-gray-200 backdrop-blur-sm border-b">
                  {group.title}
                </th>
              ))}
            </tr>
            <tr>
              <th className="px-6 py-3 sticky left-0 bg-white z-20 shadow-[2px_0_10px_-2px_rgba(0,0,0,0.05)] border-b border-gray-100"></th>
              {resourceGroups.flatMap((group) =>
                group.resources.map(recurso => (
                  <th key={recurso.key} colSpan="4" className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider border-l-2 border-white bg-gray-50/30 text-gray-700 border-b border-gray-100">
                    {recurso.name}
                  </th>
                ))
              )}
            </tr>
            <tr>
              <th className="px-6 py-3 sticky left-0 bg-white z-20 shadow-[2px_0_10px_-2px_rgba(0,0,0,0.05)] border-b border-gray-100"></th>
              {resourceGroups.flatMap(group =>
                group.resources.map(recurso => (
                  <Fragment key={recurso.key}>
                    <th className="px-2 py-2.5 text-center text-[9px] font-extrabold text-gray-400 tracking-wider uppercase border-l-2 border-gray-100 bg-gray-50/30 border-b" title="Listar e Ver Detalhes">Ver</th>
                    <th className="px-2 py-2.5 text-center text-[9px] font-extrabold text-gray-400 tracking-wider uppercase border-l border-gray-100 bg-gray-50/30 border-b" title="Criar Novos">Criar</th>
                    <th className="px-2 py-2.5 text-center text-[9px] font-extrabold text-gray-400 tracking-wider uppercase border-l border-gray-100 bg-gray-50/30 border-b" title="Editar Existentes">Edit</th>
                    <th className="px-2 py-2.5 text-center text-[9px] font-extrabold text-gray-400 tracking-wider uppercase border-l border-gray-100 bg-gray-50/30 border-b" title="Remover Registros">Del</th>
                  </Fragment>
                ))
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {funcoes.map((funcao, rowIndex) => (
              <tr key={funcao.id} className="hover:bg-blue-50/30 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 shadow-[2px_0_10px_-2px_rgba(0,0,0,0.05)] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${funcao.nome_funcao === 'Proprietário' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                      {funcao.nome_funcao.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="font-extrabold text-sm text-gray-700">
                      {funcao.nome_funcao}
                    </span>
                  </div>
                </td>
                {resourceGroups.flatMap(group =>
                  group.resources.map(recurso => (
                    <Fragment key={recurso.key}>
                      {['pode_ver', 'pode_criar', 'pode_editar', 'pode_excluir'].map((tipo, tipoIndex) => {
                        const isChecked = getPermissao(funcao, recurso.key, tipo);
                        const borderClass = tipoIndex === 0 ? 'border-l-2 border-gray-100' : 'border-l border-gray-50';

                        // Cores de ícones unificados para clean design (Azul Principal)
                        let activeColor = 'text-gray-400';
                        if (isChecked) {
                          activeColor = 'text-white bg-blue-600 border-blue-600 shadow-sm';
                        } else {
                          activeColor = 'border-gray-200 bg-white/50 text-transparent'; // Unchecked visual
                        }

                        // Disabled visual para o dono
                        if (funcao.nome_funcao === 'Proprietário') {
                          activeColor = 'bg-gray-100 border-gray-200 text-gray-400 opacity-50';
                        }

                        return (
                          <td
                            key={tipo}
                            className={`px-2 py-3 text-center ${funcao.nome_funcao !== 'Proprietário' ? 'cursor-pointer hover:bg-gray-100/50' : 'cursor-not-allowed'} ${borderClass}`}
                            onMouseDown={() => handleMouseDown(funcao.id, recurso.key, tipo, isChecked)}
                            onMouseEnter={() => handleMouseEnter(funcao.id, recurso.key, tipo)}
                          >
                            <div className={`mx-auto w-5 h-5 rounded flex items-center justify-center border transition-all duration-200 ${activeColor} ${isChecked ? 'scale-110' : 'hover:border-gray-300'}`}>
                              {isChecked && <svg className="w-3.5 h-3.5 current-color" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                          </td>
                        );
                      })}
                    </Fragment>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center text-[11px] font-bold text-gray-500 mt-2 px-4 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
        <p className="flex items-center gap-2"><span className="bg-white p-1 rounded shadow-sm text-yellow-500 text-sm">💡</span> Dica de Ouro: Clique e arraste pelos quadradinhos para marcar (ou desmarcar) blocos inteiros rapidamente.</p>
        <p className="flex items-center gap-2 text-indigo-400 bg-indigo-50 px-3 py-1.5 rounded-lg"><FontAwesomeIcon icon={faShieldAlt} /> O cargo 'Proprietário' é do sistema e possui acesso irrestrito.</p>
      </div>
    </div>
  );
}