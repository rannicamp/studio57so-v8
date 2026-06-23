"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useDebounce } from 'use-debounce';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEdit, faSearch, faFilter, faSpinner, faTimes,
  faCheckCircle, faUsers, faUserShield, faBuilding, faBriefcase
} from '@fortawesome/free-solid-svg-icons';

export default function AdminUsuariosPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Estados locais dos Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [orgFilter, setOrgFilter] = useState('todos');
  const [debouncedSearch] = useDebounce(searchTerm, 1000);

  // Ref de montagem para persistência
  const isMounted = useRef(false);

  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    sobrenome: '',
    organizacao_id: '',
    funcao_id: '',
    is_superadmin: false,
    is_active: true
  });

  // 1. CARREGAR FILTROS SALVOS NO LOCALSTORAGE
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSearch = localStorage.getItem('s57_admin_user_search') || '';
      const savedOrg = localStorage.getItem('s57_admin_user_org') || 'todos';
      setSearchTerm(savedSearch);
      setOrgFilter(savedOrg);
      isMounted.current = true;
    }
  }, []);

  // 2. PERSISTIR FILTROS NO LOCALSTORAGE
  useEffect(() => {
    if (isMounted.current) {
      localStorage.setItem('s57_admin_user_search', searchTerm);
      localStorage.setItem('s57_admin_user_org', orgFilter);
    }
  }, [searchTerm, orgFilter]);

  // 3. BUSCAR USUÁRIOS (Leitura)
  const { data: usuarios = [], isLoading, isFetching } = useQuery({
    queryKey: ['admin_usuarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  // 4. BUSCAR ORGANIZAÇÕES (Dropdown)
  const { data: organizacoes = [] } = useQuery({
    queryKey: ['admin_organizacoes_dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizacoes')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  // Mapear nomes de organizações por ID no frontend
  const mapaOrganizacoes = useMemo(() => {
    const mapa = {};
    organizacoes.forEach(org => {
      mapa[org.id] = org.nome;
    });
    return mapa;
  }, [organizacoes]);

  // 5. BUSCAR CARGOS / FUNÇÕES (Dropdown)
  const { data: funcoes = [] } = useQuery({
    queryKey: ['admin_funcoes_dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funcoes')
        .select('id, nome_funcao')
        .order('nome_funcao', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  // Mapear cargos por ID no frontend
  const mapaFuncoes = useMemo(() => {
    const mapa = {};
    funcoes.forEach(func => {
      mapa[func.id] = func.nome_funcao;
    });
    return mapa;
  }, [funcoes]);

  // 6. FILTRAGEM DE USUÁRIOS NO CLIENT
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(user => {
      const nomeCompleto = `${user.nome || ''} ${user.sobrenome || ''} ${user.email || ''}`.toLowerCase();
      const bateBusca = nomeCompleto.includes(debouncedSearch.toLowerCase());
      
      const userOrg = String(user.organizacao_id || '');
      const bateOrg = orgFilter === 'todos' || userOrg === orgFilter;
      
      return bateBusca && bateOrg;
    });
  }, [usuarios, debouncedSearch, orgFilter]);

  // MUTAÇÃO (Update)
  const updateUserMutation = useMutation({
    mutationFn: async (updatedData) => {
      const payload = {
        nome: updatedData.nome,
        sobrenome: updatedData.sobrenome,
        organizacao_id: parseInt(updatedData.organizacao_id, 10),
        funcao_id: updatedData.funcao_id ? parseInt(updatedData.funcao_id, 10) : null,
        is_superadmin: updatedData.is_superadmin,
        is_active: updatedData.is_active,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('usuarios')
        .update(payload)
        .eq('id', editingUser.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['admin_usuarios'] });
      closeModal();
    },
    onError: (err) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    }
  });

  const openModal = (user) => {
    setEditingUser(user);
    setFormData({
      nome: user.nome || '',
      sobrenome: user.sobrenome || '',
      organizacao_id: user.organizacao_id ? String(user.organizacao_id) : '',
      funcao_id: user.funcao_id ? String(user.funcao_id) : '',
      is_superadmin: !!user.is_superadmin,
      is_active: user.is_active !== false
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      return toast.error("O nome é obrigatório.");
    }
    if (!formData.organizacao_id) {
      return toast.error("A organização vinculada é obrigatória.");
    }

    updateUserMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Módulo Padrão Ouro */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-800">Usuários da Plataforma</h2>
          </div>
          <p className="text-gray-500 font-medium">Controle os usuários de todas as organizações SaaS, ajuste cargos e privilégios administrativos.</p>
        </div>
      </div>

      {/* Busca e Filtros */}
      <div className="bg-white p-5 border border-gray-200 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow relative">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Buscar Usuário (Nome ou E-mail)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Pesquise pelo nome, sobrenome ou e-mail..."
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
              Filtrar por Organização
            </label>
            <select
              value={orgFilter}
              onChange={e => setOrgFilter(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
            >
              <option value="todos">Todas as Organizações</option>
              {organizacoes.map(org => (
                <option key={org.id} value={String(org.id)}>{org.nome}</option>
              ))}
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

      {/* Tabela Padrão Ouro */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
            <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-3xl" />
            <span className="text-sm font-medium text-gray-500">Carregando usuários...</span>
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-400 shadow-sm border border-blue-100">
              <FontAwesomeIcon icon={faUsers} className="text-2xl" />
            </div>
            <h3 className="text-sm font-bold text-gray-800 mb-1">Nenhum usuário encontrado</h3>
            <p className="text-xs font-medium text-gray-500 max-w-sm mx-auto">Sua listagem está vazia para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome Completo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-mail</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organização</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo / Função</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Permissão</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acesso</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {usuariosFiltrados.map((user) => {
                  const orgNome = mapaOrganizacoes[user.organizacao_id] || `Org #${user.organizacao_id}`;
                  const cargoNome = mapaFuncoes[user.funcao_id] || '-';
                  const ultimoAcessoStr = user.ultimo_acesso 
                    ? new Date(user.ultimo_acesso).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : 'Nunca';

                  return (
                    <tr key={user.id} className="hover:bg-blue-50/20 transition-colors group cursor-pointer">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                              {(user.nome || 'U').substring(0, 1)}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-gray-700 block">
                              {user.nome || '-'} {user.sobrenome || ''}
                            </span>
                            {!user.is_active && (
                              <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-red-50 text-red-700 border border-red-200 uppercase mt-0.5 inline-block">
                                Inativo
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-3 text-sm text-gray-500 font-medium">
                        {user.email}
                      </td>

                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                          <FontAwesomeIcon icon={faBuilding} className="text-gray-400 text-xs" />
                          {orgNome}
                        </span>
                      </td>

                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 font-medium">
                          <FontAwesomeIcon icon={faBriefcase} className="text-gray-400 text-xs" />
                          {cargoNome}
                        </span>
                      </td>

                      <td className="px-6 py-3 text-center">
                        {user.is_superadmin ? (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase inline-flex items-center gap-1">
                            <FontAwesomeIcon icon={faUserShield} size="xs" /> Super Admin
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-gray-50 text-gray-500 border border-gray-200 uppercase">
                            Usuário
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-3 text-center text-xs text-gray-500 font-medium">
                        {ultimoAcessoStr}
                      </td>

                      <td className="px-6 py-3 text-right">
                        {/* Ações Família A */}
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openModal(user)} 
                            title="Editar Perfil"
                            className="text-blue-500 hover:text-blue-700 p-2 transition-colors"
                          >
                            <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
                          </button>
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

      {/* Modal de Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-lg w-full relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Barra viva lateral */}
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>

            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-base">
                Editar Cadastro de Usuário
              </h3>
              <button 
                onClick={closeModal} 
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100"
              >
                <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nome
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.nome}
                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Sobrenome
                  </label>
                  <input
                    type="text"
                    value={formData.sobrenome}
                    onChange={e => setFormData({ ...formData, sobrenome: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm placeholder-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Organização Associada (Hub)
                </label>
                <select
                  required
                  value={formData.organizacao_id}
                  onChange={e => setFormData({ ...formData, organizacao_id: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                >
                  <option value="" disabled>Selecione uma Organização...</option>
                  {organizacoes.map(org => (
                    <option key={org.id} value={String(org.id)}>{org.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Cargo / Função do Sistema
                </label>
                <select
                  value={formData.funcao_id}
                  onChange={e => setFormData({ ...formData, funcao_id: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                >
                  <option value="">Nenhum Cargo (Padrão)</option>
                  {funcoes.map(func => (
                    <option key={func.id} value={String(func.id)}>{func.nome_funcao}</option>
                  ))}
                </select>
              </div>

              {/* Checkboxes de Status e Permissões */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_superadmin"
                    checked={formData.is_superadmin}
                    onChange={e => setFormData({ ...formData, is_superadmin: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_superadmin" className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Habilitar Acesso como <strong className="text-blue-600 font-bold">Super Admin</strong> (Pode gerenciar o Backoffice)
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Conta Ativa (Usuário consegue efetuar login)
                  </label>
                </div>
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
                  disabled={updateUserMutation.isPending}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm"
                >
                  {updateUserMutation.isPending && (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  )}
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
