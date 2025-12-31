"use client";

import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

// 1. Busca os dados do usuário (perfil)
async function fetchUserProfile() {
  const supabase = createClient();
  
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    return null;
  }
  
  const { data: userProfile, error: profileError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', authUser.id)
    .single();
    
  if (profileError) {
    console.error("Erro ao buscar perfil:", profileError.message);
    return authUser; 
  }
  
  return userProfile;
}

const LayoutContext = createContext();

export function LayoutProvider({ children }) {
  const [pageTitle, setPageTitle] = useState('Dashboard');
  // NOVO: Estado local para controlar a posição do menu
  const [sidebarPosition, setSidebarPosition] = useState('left'); 

  // 2. Busca dados do usuário (cacheado pelo TanStack Query)
  const { 
    data: user, 
    isLoading: isUserLoading, 
    isError 
  } = useQuery({
    queryKey: ['userProfile'], 
    queryFn: fetchUserProfile, 
    staleTime: 1000 * 60 * 30, // 30 minutos
    refetchOnWindowFocus: false, 
  });

  // 3. NOVO: Sincroniza o estado local com o banco assim que o usuário carrega
  useEffect(() => {
    if (user?.sidebar_position) {
      setSidebarPosition(user.sidebar_position);
    }
  }, [user]);

  // 4. Pacote de dados compartilhado (Contexto)
  const value = useMemo(() => ({
    pageTitle, 
    setPageTitle,
    sidebarPosition,    // <--- Agora exposto
    setSidebarPosition, // <--- Agora exposto (resolve o erro)
    user, 
    isUserLoading,
    isError
  }), [pageTitle, sidebarPosition, user, isUserLoading, isError]);

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout deve ser usado dentro de um LayoutProvider');
  }
  return context;
}