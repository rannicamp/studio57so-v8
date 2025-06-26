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
  const [permissions, setPermissions] = useState({}); // NOVO ESTADO

  const fetchProfileAndPermissions = useCallback(async (currentUser) => {
    if (!currentUser) {
      setUserData(null);
      setIsProprietario(false);
      setCanViewSalaries(false);
      setPermissions({}); // LIMPA PERMISSÕES
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: profileData, error } = await supabase
      .from('usuarios')
      .select(`
        *,
        funcao:funcoes ( id, nome_funcao )
      `)
      .eq('id', currentUser.id)
      .single();

    if (error) {
      console.error("Erro ao buscar perfil do usuário:", error);
      setUserData(null);
      setIsProprietario(false);
      setCanViewSalaries(false);
      setPermissions({});
    } else {
      setUserData(profileData);
      const userRole = profileData?.funcao;
      
      const isUserProprietario = userRole?.nome_funcao === 'Proprietário';
      setIsProprietario(isUserProprietario);
      setCanViewSalaries(isUserProprietario || userRole?.nome_funcao === 'Administrativo');

      // NOVA LÓGICA: BUSCAR PERMISSÕES
      if (isUserProprietario) {
          // Proprietário tem todas as permissões
          const allResources = ['empresas', 'empreendimentos', 'funcionarios', 'atividades', 'rdo', 'usuarios', 'permissoes'];
          const allPermissions = allResources.reduce((acc, resource) => {
              acc[resource] = { pode_criar: true, pode_excluir: true, pode_editar: true, pode_ver: true };
              return acc;
          }, {});
          setPermissions(allPermissions);
      } else if (userRole?.id) {
          const { data: perms, error: permsError } = await supabase
              .from('permissoes')
              .select('*')
              .eq('funcao_id', userRole.id);

          if (permsError) {
              console.error("Erro ao buscar permissões:", permsError);
              setPermissions({});
          } else {
              const userPermissions = perms.reduce((acc, p) => {
                  acc[p.recurso] = {
                      pode_criar: p.pode_criar,
                      pode_excluir: p.pode_excluir,
                      pode_editar: p.pode_editar,
                      pode_ver: p.pode_ver,
                  };
                  return acc;
              }, {});
              setPermissions(userPermissions);
          }
      } else {
          setPermissions({}); // Nenhuma função, nenhuma permissão
      }
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

  // NOVA FUNÇÃO: Helper para verificar permissões
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
    permissions, // Expondo as permissões
    hasPermission, // Expondo a nova função
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