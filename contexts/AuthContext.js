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

  const fetchProfileAndPermissions = useCallback(async (currentUser) => {
    if (!currentUser) {
      setUserData(null);
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
    } else if (profileData) {
      setUserData(profileData);
      
      const userRole = profileData?.funcoes;
      const isUserProprietario = userRole?.nome_funcao === 'Proprietário';
      setIsProprietario(isUserProprietario);
      setCanViewSalaries(isUserProprietario || userRole?.nome_funcao === 'Administrativo');
      
      if (isUserProprietario) {
          const allResources = ['empresas', 'empreendimentos', 'funcionarios', 'atividades', 'rdo', 'usuarios', 'permissoes'];
          const allPermissions = allResources.reduce((acc, resource) => {
              acc[resource] = { pode_criar: true, pode_excluir: true, pode_editar: true, pode_ver: true };
              return acc;
          }, {});
          setPermissions(allPermissions);
      } else if (userRole?.id) {
          const { data: perms } = await supabase.from('permissoes').select('*').eq('funcao_id', userRole.id);
          const userPermissions = (perms || []).reduce((acc, p) => {
              acc[p.recurso] = { pode_criar: p.pode_criar, pode_excluir: p.pode_excluir, pode_editar: p.pode_editar, pode_ver: p.pode_ver };
              return acc;
          }, {});
          setPermissions(userPermissions);
      } else {
          setPermissions({});
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user;
      setUser(currentUser ?? null);
      fetchProfileAndPermissions(currentUser);
    });

    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, [supabase, fetchProfileAndPermissions]);

  const hasPermission = (recurso, permissao) => {
    if (isProprietario) return true;
    return permissions[recurso]?.[permissao] || false;
  };

  const value = { user, userData, loading, isProprietario, canViewSalaries, permissions, hasPermission };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}