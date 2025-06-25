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

  // Função para buscar os dados do usuário e sua função
  const fetchProfileAndPermissions = useCallback(async (currentUser) => {
    if (!currentUser) {
      setUserData(null);
      setIsProprietario(false);
      setCanViewSalaries(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Busca o perfil do usuário e a sua função (funcoes) associada
    const { data: profileData, error } = await supabase
      .from('usuarios')
      .select(`
        *,
        funcao:funcoes ( nome_funcao )
      `)
      .eq('id', currentUser.id)
      .single();

    if (error) {
      console.error("Erro ao buscar perfil do usuário:", error);
      setUserData(null);
      setIsProprietario(false);
      setCanViewSalaries(false);
    } else {
      setUserData(profileData);
      const userRole = profileData?.funcao?.nome_funcao;
      
      // Define as permissões com base na função do usuário
      const isUserProprietario = userRole === 'Proprietário';
      setIsProprietario(isUserProprietario);
      setCanViewSalaries(isUserProprietario || userRole === 'Administrativo');
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // Busca a sessão inicial ao carregar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      fetchProfileAndPermissions(session?.user);
    });

    // Escuta por mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      fetchProfileAndPermissions(session?.user);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, fetchProfileAndPermissions]);

  const value = {
    user,
    userData,
    loading,
    isProprietario,
    canViewSalaries,
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