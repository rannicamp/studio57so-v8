// contexts/LayoutContext.js
"use client";

import { createContext, useContext, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

// 1. Criamos a função de busca de dados (fora do componente)
// Ela busca o usuário logado E o perfil dele na tabela 'usuarios'
async function fetchUserProfile() {
  const supabase = createClient();
  
  // Primeiro, pega o usuário da autenticação
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    // Se não tiver usuário logado, retorna null
    return null;
  }
  
  // Se tem usuário, busca o perfil dele na tabela 'usuarios'
  const { data: userProfile, error: profileError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', authUser.id)
    .single();
    
  if (profileError) {
    console.error("Erro ao buscar perfil do usuário:", profileError.message);
    // Retorna o usuário da autenticação (auth) mesmo se o perfil falhar
    // Suas páginas (como a de clientes) precisam do 'user.id'
    return authUser; 
  }
  
  // Retorna o perfil completo da tabela 'usuarios'
  // que também inclui o 'id', 'email', etc.
  return userProfile;
}


const LayoutContext = createContext();

export function LayoutProvider({ children }) {
  const [pageTitle, setPageTitle] = useState('Dashboard'); // Título padrão

  // 2. Usamos o useQuery para buscar os dados do usuário
  // Conforme nossas regras, isto substitui useState + useEffect
  const { 
    data: user, // 'data' é re-nomeado para 'user'
    isLoading: isUserLoading, // Podemos usar isso para mostrar um "Carregando"
    isError 
  } = useQuery({
    queryKey: ['userProfile'], // Chave de cache para o usuário
    queryFn: fetchUserProfile, // A função que criamos ali em cima
    staleTime: 1000 * 60 * 30, // 30 minutos de "cache"
    refetchOnWindowFocus: false, // Não precisa buscar de novo só por trocar de aba
  });

  // 3. Criamos o "pacote" de dados (o 'value')
  // Usamos o useMemo para otimizar e não recriar isso em toda renderização
  const value = useMemo(() => ({
    pageTitle, 
    setPageTitle,
    user, // <--- AQUI ESTÁ A MÁGICA!
    isUserLoading,
    isError
  }), [pageTitle, user, isUserLoading, isError]);

  // 4. Fornecemos o 'value' completo para todos os 'children'
  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    // Esta mensagem de erro agora é útil de verdade
    throw new Error('useLayout deve ser usado dentro de um LayoutProvider');
  }
  return context;
}