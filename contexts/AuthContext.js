"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        
        const { data: profileData } = await supabase
          .from('usuarios')
          .select('*, funcao:funcoes(*)')
          .eq('id', session.user.id)
          .single();
          
        setUserData(profileData);
      }
      setLoading(false);
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' && session?.user) {
        fetchSession();
      }
      if (event === 'SIGNED_OUT') {
        setUserData(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);
  
  // LÓGICA ATUALIZADA AQUI
  const userRole = userData?.funcao?.nome_funcao;
  const value = {
    user,
    userData,
    loading,
    // A nova permissão verifica se a função é uma das duas permitidas
    canViewSalaries: userRole === 'Proprietário' || userRole === 'Administrativo',
    isProprietario: userRole === 'Proprietário'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}