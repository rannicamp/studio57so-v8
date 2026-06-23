"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useDebounce } from 'use-debounce';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faEdit, faTrash, faSearch, faFilter, faSpinner,
  faTimes, faCheckCircle, faBuilding, faUsers, faCalendarAlt,
  faHistory, faWarning, faKey
} from '@fortawesome/free-solid-svg-icons';

export default function AdminOrganizacoesPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Chaveador de Abas (Hubs vs Logs de Exclusão)
  const [activeTab, setActiveTab] = useState('hubs'); // 'hubs' ou 'logs'

  // Estados locais dos Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [debouncedSearch] = useDebounce(searchTerm, 1000);

  // Refs para restaurar foco ou persistência
  const isMounted = useRef(false);

  // Estados do Modal de Criação/Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null); // null = Criando nova
  const [formData, setFormData] = useState({
    nome: '',
    subscription_status: 'trialing',
    trial_ends_at: '',
    subscription_expires_at: ''
  });

  // Estados do Modal de Confirmação de Senha para Exclusão
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState(null); // { id, nome }
  const [deletePassword, setDeletePassword] = useState('');
  const [isValidatingPassword, setIsValidatingPassword] = useState(false);

  // 1. CARREGAR FILTROS SALVOS NO LOCALSTORAGE
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSearch = localStorage.getItem('s57_admin_org_search') || '';
      const savedStatus = localStorage.getItem('s57_admin_org_status') || 'todos';
      setSearchTerm(savedSearch);
      setStatusFilter(savedStatus);
      isMounted.current = true;
    }
  }, []);

  // 2. PERSISTIR FILTROS NO LOCALSTORAGE
  useEffect(() => {
    if (isMounted.current) {
      localStorage.setItem('s57_admin_org_search', searchTerm);
      localStorage.setItem('s57_admin_org_status', statusFilter);
    }
  }, [searchTerm, statusFilter]);

  // 3. BUSCAR ORGANIZAÇÕES (Leitura)
  const { data: organizacoes = [], isLoading, isFetching } = useQuery({
    queryKey: ['admin_organizacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizacoes')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  // 4. BUSCAR LOGS DE EXCLUSÃO (Audit Logs)
  const { data: logsExclusao = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ['admin_logs_exclusao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logs_exclusao_organizacoes')
        .select('*')
        .order('excluido_em', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === 'logs'
  });

  // 5. BUSCAR USUÁRIOS PARA CONTAGEM POR ORG
  const { data: usuarios = [] } = useQuery({
    queryKey: ['admin_usuarios_contagem'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, organizacao_id');

      if (error) throw error;
      return data || [];
    }
  });

  // Mapear contagem de usuários por organização
  const contagemUsuarios = useMemo(() => {
    const mapa = {};
    usuarios.forEach(user => {
      if (user.organizacao_id) {
        mapa[user.organizacao_id] = (mapa[user.organizacao_id] || 0) + 1;
      }
    });
    return mapa;
  }, [usuarios]);

  // 6. FILTRAGEM DOS DADOS NO CLIENT (Busca + Status)
  const organizacoesFiltradas = useMemo(() => {
    return organizacoes.filter(org => {
      const bateNome = org.nome.toLowerCase().includes(debouncedSearch.toLowerCase());
      const statusOrg = (org.subscription_status || 'trialing').trim();
      const bateStatus = statusFilter === 'todos' || statusOrg === statusFilter;
      return bateNome && bateStatus;
    });
  }, [organizacoes, debouncedSearch, statusFilter]);

  // MUTAÇÕES (CUD)
  // Criar Organização
  const createOrgMutation = useMutation({
    mutationFn: async (newOrg) => {
      const payload = {
        nome: newOrg.nome,
        subscription_status: newOrg.subscription_status,
        trial_ends_at: newOrg.subscription_status === 'lifetime' ? null : (newOrg.trial_ends_at || null),
        subscription_expires_at: newOrg.subscription_status === 'lifetime' ? null : (newOrg.subscription_expires_at || null)
      };

      const { data, error } = await supabase
        .from('organizacoes')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Organização criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['admin_organizacoes'] });
      closeModal();
    },
    onError: (err) => {
      toast.error(`Erro ao criar organização: ${err.message}`);
    }
  });

  // Atualizar Organização
  const updateOrgMutation = useMutation({
    mutationFn: async (updatedOrg) => {
      const payload = {
        nome: updatedOrg.nome,
        subscription_status: updatedOrg.subscription_status,
        trial_ends_at: updatedOrg.subscription_status === 'lifetime' ? null : (updatedOrg.trial_ends_at || null),
        subscription_expires_at: updatedOrg.subscription_status === 'lifetime' ? null : (updatedOrg.subscription_expires_at || null)
      };

      const { data, error } = await supabase
        .from('organizacoes')
        .update(payload)
        .eq('id', editingOrg.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Organização atualizada!");
      queryClient.invalidateQueries({ queryKey: ['admin_organizacoes'] });
      closeModal();
    },
    onError: (err) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    }
  });

  // Excluir Organização com Cascade via RPC
  const deleteOrgMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .rpc('fn_excluir_organizacao_completa', { p_org_id: id });

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      toast.success("Organização e todos os seus dados foram excluídos permanentemente!");
      queryClient.invalidateQueries({ queryKey: ['admin_organizacoes'] });
      queryClient.invalidateQueries({ queryKey: ['admin_logs_exclusao'] });
      closeDeleteModal();
    },
    onError: (err) => {
      toast.error(`Falha na exclusão em cascata: ${err.message}`);
    }
  });

  // Manipulação do Modal de Cadastro/Edição
  const openModal = (org = null) => {
    if (org) {
      setEditingOrg(org);
      const formatarData = (dt) => dt ? dt.substring(0, 10) : '';
      
      setFormData({
        nome: org.nome,
        subscription_status: (org.subscription_status || 'trialing').trim(),
        trial_ends_at: formatarData(org.trial_ends_at),
        subscription_expires_at: formatarData(org.subscription_expires_at)
      });
    } else {
      setEditingOrg(null);
      const quinzeDias = new Date();
      quinzeDias.setDate(quinzeDias.getDate() + 15);
      const dataStr = quinzeDias.toISOString().substring(0, 10);
      
      setFormData({
        nome: '',
        subscription_status: 'trialing',
        trial_ends_at: dataStr,
        subscription_expires_at: dataStr
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOrg(null);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      return toast.error("O nome da organização é obrigatório.");
    }

    if (editingOrg) {
      updateOrgMutation.mutate(formData);
    } else {
      createOrgMutation.mutate(formData);
    }
  };

  // Manipulação do Modal de Confirmação de Exclusão por Senha
  const openDeleteModal = (id, nome) => {
    setOrgToDelete({ id, nome });
    setDeletePassword('');
    setIsDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteOpen(false);
    setOrgToDelete(null);
    setDeletePassword('');
    setIsValidatingPassword(false);
  };

  const handleDeleteConfirm = async (e) => {
    e.preventDefault();
    if (!deletePassword) {
      return toast.error("Por favor, digite a sua senha para confirmar.");
    }

    setIsValidatingPassword(true);
    try {
      // 1. Recuperar o e-mail do usuário autenticado no momento
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) {
        throw new Error("Não foi possível obter o e-mail do administrador ativo.");
      }

      // 2. Tentar autenticar novamente para validar a senha
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword
      });

      if (authError) {
        throw new Error("Senha administrativa incorreta! Operação negada.");
      }

      // 3. Senha correta, acionar a exclusão em cascata
      deleteOrgMutation.mutate(orgToDelete.id);

    } catch (err) {
      toast.error(err.message);
      setIsValidatingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Módulo Padrão Ouro */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-800">Organizações (Hubs)</h2>
          </div>
          <p className="text-gray-500 font-medium">Cadastre, gerencie as contas multi-tenant SaaS e audite as exclusões permanentemente.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {activeTab === 'hubs' && (
            <button 
              onClick={() => openModal()} 
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 hover:shadow-lg transition-all flex items-center gap-2 shadow-sm shadow-blue-500/30"
            >
              <FontAwesomeIcon icon={faPlus} /> Nova Organização
            </button>
          )}
        </div>
      </div>

      {/* Seleção de Abas */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('hubs')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'hubs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FontAwesomeIcon icon={faBuilding} className="text-xs" />
          Ativas & Planos
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FontAwesomeIcon icon={faHistory} className="text-xs" />
          Registro de Exclusões (Audit)
        </button>
      </div>

      {activeTab === 'hubs' ? (
        <>
          {/* Caixa de Busca e Filtros */}
          <div className="bg-white p-5 border border-gray-200 rounded-lg shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Buscar Organização
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Pesquise pelo nome..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-400 shadow-sm"
                  />
                  <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 top-3.5 text-gray-400 w-4 h-4" />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')} 
                      className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full md:w-64">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Status da Assinatura
                </label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="trialing">Trialing (Teste)</option>
                  <option value="active">Active (Ativa)</option>
                  <option value="lifetime">Lifetime (Vitalício)</option>
                  <option value="overdue">Overdue (Atrasada)</option>
                  <option value="suspended">Suspended (Suspensa)</option>
                  <option value="canceled">Canceled (Cancelada)</option>
                </select>
              </div>
            </div>

            {/* Feedback Sincronia */}
            {isFetching && !isLoading && (
              <div className="text-[11px] text-blue-500 font-bold mt-3 flex items-center gap-1.5 animate-pulse">
                <FontAwesomeIcon icon={faSpinner} spin className="w-3 h-3" />
                Página atualizada em background!
              </div>
            )}
          </div>

          {/* Listagem (Tabela Padrão Ouro) */}
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
                <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-3xl" />
                <span className="text-sm font-medium text-gray-500">Carregando organizações...</span>
              </div>
            ) : organizacoesFiltradas.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-400 shadow-sm border border-blue-100">
                  <FontAwesomeIcon icon={faBuilding} className="text-2xl" />
                </div>
                <h3 className="text-sm font-bold text-gray-800 mb-1">Nenhuma organização encontrada</h3>
                <p className="text-xs font-medium text-gray-500 max-w-sm mx-auto">Sua listagem está vazia para os filtros aplicados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-200">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome da Organização</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assinatura</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fim Trial</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiração</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Usuários</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {organizacoesFiltradas.map((org) => {
                      const status = (org.subscription_status || 'trialing').trim().toLowerCase();
                      const qtdUsers = contagemUsuarios[org.id] || 0;

                      return (
                        <tr key={org.id} className="hover:bg-blue-50/20 transition-colors group cursor-pointer">
                          <td className="px-6 py-3 text-sm text-gray-500 font-mono font-bold">
                            {org.id}
                          </td>
                          
                          <td className="px-6 py-3 font-semibold text-gray-700">
                            {org.nome}
                            {org.id === 1 && (
                              <span className="ml-2 bg-blue-50 text-blue-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-blue-200 uppercase">
                                Sistema
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-3">
                            <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase border ${
                              status === 'active' 
                                ? 'bg-green-50 text-green-700 border-green-200' 
                                : status === 'trialing' 
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : status === 'lifetime'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : status === 'overdue'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {status === 'lifetime' ? 'vitalício' : status}
                            </span>
                          </td>

                          <td className="px-6 py-3 text-sm text-gray-500 font-medium">
                            {status === 'lifetime' ? (
                              <span className="text-purple-600 font-bold">Infinito</span>
                            ) : org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString('pt-BR') : '-'}
                          </td>

                          <td className="px-6 py-3 text-sm text-gray-500 font-medium">
                            {status === 'lifetime' ? (
                              <span className="text-purple-600 font-bold">Infinito</span>
                            ) : org.subscription_expires_at ? new Date(org.subscription_expires_at).toLocaleDateString('pt-BR') : '-'}
                          </td>

                          <td className="px-6 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                              <FontAwesomeIcon icon={faUsers} className="text-gray-400 text-xs" />
                              {qtdUsers}
                            </span>
                          </td>

                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => openModal(org)} 
                                title="Editar Organização"
                                className="text-blue-500 hover:text-blue-700 p-2 transition-colors"
                              >
                                <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
                              </button>
                              
                              {org.id !== 1 && (
                                <button 
                                  onClick={() => openDeleteModal(org.id, org.nome)} 
                                  title="Remover Organização e dados em Cascata"
                                  className="text-red-500 hover:text-red-700 p-2 transition-colors"
                                >
                                  <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                                </button>
                              )}
                            </div>
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
      ) : (
        /* ABA DE REGISTRO DE AUDITORIA DE EXCLUSÕES */
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
          {isLoadingLogs ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
              <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-3xl" />
              <span className="text-sm font-medium text-gray-500">Carregando auditoria de logs...</span>
            </div>
          ) : logsExclusao.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-400 shadow-sm border border-blue-100">
                <FontAwesomeIcon icon={faHistory} className="text-2xl" />
              </div>
              <h3 className="text-sm font-bold text-gray-800 mb-1">Nenhum log de exclusão registrado</h3>
              <p className="text-xs font-medium text-gray-500 max-w-sm mx-auto">Nenhuma organização foi removida até o momento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto animate-in fade-in duration-200">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Super Admin Responsável</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-mail</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organização Deletada (ID)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Excluído em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {logsExclusao.map((log) => (
                    <tr key={log.id} className="hover:bg-red-50/10 transition-colors">
                      <td className="px-6 py-3 font-semibold text-gray-700">
                        {log.superadmin_nome}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 font-medium">
                        {log.superadmin_email}
                      </td>
                      <td className="px-6 py-3 text-sm font-bold text-red-600">
                        {log.org_nome} <span className="text-gray-400 font-normal">({log.org_id})</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 font-medium">
                        {new Date(log.excluido_em).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Criar/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-lg w-full relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>

            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-base">
                {editingOrg ? 'Editar Organização' : 'Nova Organização'}
              </h3>
              <button 
                onClick={closeModal} 
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100"
              >
                <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Nome do Hub (Razão / Fantasia)
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Construtora Elo e Cia"
                  value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm placeholder-gray-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Status da Assinatura
                  </label>
                  <select
                    value={formData.subscription_status}
                    onChange={e => setFormData({ ...formData, subscription_status: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                  >
                    <option value="trialing">Trialing (Teste)</option>
                    <option value="active">Active (Ativa)</option>
                    <option value="lifetime">Lifetime (Vitalício)</option>
                    <option value="overdue">Overdue (Atrasada)</option>
                    <option value="suspended">Suspended (Suspensa)</option>
                    <option value="canceled">Canceled (Cancelada)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Fim do Período de Testes
                  </label>
                  <input
                    type="date"
                    disabled={formData.subscription_status === 'lifetime'}
                    value={formData.subscription_status === 'lifetime' ? '' : formData.trial_ends_at}
                    onChange={e => setFormData({ ...formData, trial_ends_at: e.target.value })}
                    className={`w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm ${
                      formData.subscription_status === 'lifetime' ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Expiração da Assinatura (SaaS)
                </label>
                <input
                  type="date"
                  disabled={formData.subscription_status === 'lifetime'}
                  value={formData.subscription_status === 'lifetime' ? '' : formData.subscription_expires_at}
                  onChange={e => setFormData({ ...formData, subscription_expires_at: e.target.value })}
                  className={`w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm ${
                    formData.subscription_status === 'lifetime' ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                  }`}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={createOrgMutation.isPending || updateOrgMutation.isPending}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm"
                >
                  {(createOrgMutation.isPending || updateOrgMutation.isPending) && (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  )}
                  Salvar Organização
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação Segura de Senha para Exclusão */}
      {isDeleteOpen && orgToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-lg border border-red-100 shadow-2xl max-w-md w-full relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Barra viva vermelha */}
            <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>

            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-red-50/20">
              <h3 className="font-bold text-red-700 text-base flex items-center gap-2">
                <FontAwesomeIcon icon={faWarning} className="text-red-500" />
                Exclusão Administrativa Segura
              </h3>
              <button 
                onClick={closeDeleteModal} 
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100"
              >
                <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDeleteConfirm} className="p-6 space-y-4">
              {/* Alerta de Perigo em Vermelho */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
                <p className="font-bold uppercase tracking-wider text-xs">⚠️ ATENÇÃO - AÇÃO IRREVERSÍVEL! ⚠️</p>
                <p className="mt-2 leading-relaxed">
                  Você está prestes a excluir permanentemente a organização <strong className="font-extrabold">"{orgToDelete.nome}"</strong> (ID: {orgToDelete.id}).
                </p>
                <p className="mt-1 leading-relaxed">
                  Isso **deletará em cascata todos os dados** vinculados a ela: usuários, contratos, lançamentos, diários de obra e arquivos do storage.
                </p>
              </div>

              <div>
                <label htmlFor="auth_challenge" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faKey} className="text-gray-400" />
                  Digite sua senha administrativa para confirmar:
                </label>

                {/* 🛡️ DECOYS INVISÍVEIS PARA ENGANAR OS GERENCIADORES DE SENHA DO BROWSER (ANTI-AUTOFILL) */}
                <input type="text" style={{ display: 'none' }} aria-hidden="true" tabIndex="-1" />
                <input type="password" style={{ display: 'none' }} aria-hidden="true" tabIndex="-1" />

                <input
                  required
                  type="password"
                  id="auth_challenge"
                  name="password_verification_challenge_field"
                  autoComplete="new-password"
                  placeholder="Confirme com sua senha..."
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm placeholder-gray-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={closeDeleteModal} 
                  disabled={isValidatingPassword}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                
                <button 
                  type="submit" 
                  disabled={isValidatingPassword || deleteOrgMutation.isPending}
                  className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 transition-all flex items-center gap-2 shadow-sm"
                >
                  {isValidatingPassword || deleteOrgMutation.isPending ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    <FontAwesomeIcon icon={faTrash} size="sm" />
                  )}
                  Excluir Tudo Permanentemente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
