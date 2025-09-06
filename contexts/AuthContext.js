"use client";

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProprietario, setIsProprietario] = useState(false);
  const [canViewSalaries, setCanViewSalaries] = useState(false);
  const [permissions, setPermissions] = useState({});
  // NOVO ESTADO PARA A POSIÇÃO DO MENU
  const [sidebarPosition, setSidebarPosition] = useState('left');

  const fetchProfileAndPermissions = useCallback(async (currentUser) => {
    if (!currentUser) {
      setUserData(null);
      setPermissions({});
      setIsProprietario(false);
      setCanViewSalaries(false);
      setSidebarPosition('left'); // Reseta para o padrão
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: profileData, error } = await supabase
      .from('usuarios')
      .select(`
        *,
        funcoes ( id, nome_funcao )
      `)
      .eq('id', currentUser.id)
      .single();

    if (error) {
      console.error("Erro ao buscar perfil do usuário:", error);
      setUserData(null);
      setPermissions({});
    } else if (profileData) {
      setUserData(profileData);
      // DEFINE A POSIÇÃO DO SIDEBAR COM BASE NO DADO DO BANCO
      setSidebarPosition(profileData.sidebar_position || 'left');
      
      const userRole = profileData?.funcoes;
      const isUserProprietario = userRole?.nome_funcao === 'Proprietário';
      setIsProprietario(isUserProprietario);

      // Define quem pode ver salários
      const canSeeSalaries = isUserProprietario || userRole?.nome_funcao === 'Administrativo';
      setCanViewSalaries(canSeeSalaries);
      
      // Se for Proprietário, concede todas as permissões
      if (isUserProprietario) {
          const allResources = ['empresas', 'empreendimentos', 'funcionarios', 'atividades', 'rdo', 'usuarios', 'permissoes', 'financeiro', 'ponto', 'orcamento', 'pedidos', 'crm', 'contatos', 'simulador', 'contratos', 'caixa-de-entrada', 'anuncios', 'dashboard', 'funil'];
          const allPermissions = allResources.reduce((acc, resource) => {
              acc[resource] = { pode_criar: true, pode_excluir: true, pode_editar: true, pode_ver: true };
              return acc;
          }, {});
          setPermissions(allPermissions);
      } else if (userRole?.id) {
          // Se não, busca as permissões específicas da função no banco
          const { data: perms, error: permError } = await supabase.from('permissoes').select('*').eq('funcao_id', userRole.id);
          if (permError) {
              console.error("Erro ao buscar permissões:", permError);
              setPermissions({});
          } else {
              const userPermissions = (perms || []).reduce((acc, p) => {
                  acc[p.recurso] = { pode_criar: p.pode_criar, pode_excluir: p.pode_excluir, pode_editar: p.pode_editar, pode_ver: p.pode_ver };
                  return acc;
              }, {});
              setPermissions(userPermissions);
          }
      } else {
          // Se não tiver função, não tem permissões
          setPermissions({});
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user;
      setUser(currentUser ?? null);
      fetchProfileAndPermissions(currentUser);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfileAndPermissions]);

  const hasPermission = (recurso, permissao) => {
    if (isProprietario) return true; // Proprietário sempre tem permissão
    return permissions[recurso]?.[permissao] || false;
  };

  // ADICIONA sidebarPosition AO VALOR DO CONTEXTO
  const value = { user, userData, loading, isProprietario, canViewSalaries, permissions, hasPermission, sidebarPosition };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}