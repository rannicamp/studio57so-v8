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
      setIsProprietario(false);
      setCanViewSalaries(false);
      setPermissions({});
      setLoading(false);
      return;
    }

    setLoading(true);

    // **A CORREÇÃO ESTÁ AQUI**:
    // 1. Buscamos primeiro os dados do usuário e sua função.
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
      // 2. Se o usuário tem um funcionário associado, buscamos a foto dele separadamente.
      if (profileData.funcionario_id) {
        const { data: funcionarioData } = await supabase
          .from('funcionarios')
          .select('foto_url')
          .eq('id', profileData.funcionario_id)
          .single();
        
        // 3. Anexamos os dados do funcionário (com a foto) ao perfil do usuário.
        profileData.funcionario = funcionarioData || null;
      }
      
      // 4. Agora, `userData` terá a estrutura correta com a foto.
      setUserData(profileData);
      
      const userRole = profileData?.funcoes;
      const isUserProprietario = userRole?.nome_funcao === 'Proprietário';
      setIsProprietario(isUserProprietario);
      setCanViewSalaries(isUserProprietario || userRole?.nome_funcao === 'Administrativo');

      // (Lógica de permissões continua a mesma)
      if (isUserProprietario) {
          const allResources = ['empresas', 'empreendimentos', 'funcionarios', 'atividades', 'rdo', 'usuarios', 'permissoes'];
          const allPermissions = allResources.reduce((acc, resource) => {
              acc[resource] = { pode_criar: true, pode_excluir: true, pode_editar: true, pode_ver: true };
              return acc;
          }, {});
          setPermissions(allPermissions);
      } else if (userRole?.id) {
          const { data: perms } = await supabase
              .from('permissoes')
              .select('*')
              .eq('funcao_id', userRole.id);
          const userPermissions = (perms || []).reduce((acc, p) => {
              acc[p.recurso] = { pode_criar: p.pode_criar, pode_excluir: p.pode_excluir, pode_editar: p.pode_editar, pode_ver: p.pode_ver };
              return acc;
          }, {});
          setPermissions(userPermissions);
      } else {
          setPermissions({});
      }
    } else {
        setUserData(null);
        setIsProprietario(false);
        setCanViewSalaries(false);
        setPermissions({});
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      fetchProfileAndPermissions(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      fetchProfileAndPermissions(session?.user);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, fetchProfileAndPermissions]);

  const hasPermission = (resource, action) => {
    if (isProprietario) return true;
    return permissions[resource]?.[action] || false;
  };

  const value = {
    user,
    userData,
    loading,
    isProprietario,
    canViewSalaries,
    permissions,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}