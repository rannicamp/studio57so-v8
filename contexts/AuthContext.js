// Local do Arquivo: contexts/AuthContext.js

"use client";

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation'; // Importa o useRouter para redirecionamento

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const supabase = createClient();
  const router = useRouter(); // Instancia o router para usá-lo
  const [user, setUser] = useState(null); // O usuário da sessão do Supabase
  const [userData, setUserData] = useState(null); // O nosso perfil completo do public.usuarios
  const [loading, setLoading] = useState(true);
  const [isProprietario, setIsProprietario] = useState(false);
  const [canViewSalaries, setCanViewSalaries] = useState(false);
  const [permissions, setPermissions] = useState({});
  const [sidebarPosition, setSidebarPosition] = useState('left');

  // Nova função centralizada para forçar o logout e limpar o estado
  const forceLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserData(null);
    setPermissions({});
    setIsProprietario(false);
    setCanViewSalaries(false);
    setLoading(false);
    // Redireciona de forma segura para a página de login
    router.push('/login?error=Sessão inválida ou usuário não encontrado.');
  }, [supabase, router]);

  const fetchProfileAndPermissions = useCallback(async (currentUser) => {
    if (!currentUser) {
      setUserData(null);
      setPermissions({});
      setIsProprietario(false);
      setCanViewSalaries(false);
      setSidebarPosition('left');
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: profileData, error } = await supabase
      .from('usuarios')
      .select('*, funcoes ( id, nome_funcao )')
      .eq('id', currentUser.id)
      .single();

    // ---> AQUI ESTÁ A CORREÇÃO MAIS IMPORTANTE <---
    if (error || !profileData) {
      console.error("URGENTE: Usuário da sessão não foi encontrado na tabela 'usuarios'. É um fantasma! Forçando logout.", error);
      // Se não encontrou o perfil, a sessão é inválida. EXPULSA O FANTASMA!
      await forceLogout();
      return; // Interrompe a execução para evitar que o resto do código rode
    }

    // Se passou pela verificação, o usuário é legítimo. Continua normalmente.
    setUserData(profileData);
    setSidebarPosition(profileData.sidebar_position || 'left');
    
    const userRole = profileData?.funcoes;
    const isUserProprietario = userRole?.nome_funcao === 'Proprietário';
    setIsProprietario(isUserProprietario);

    const canSeeSalaries = isUserProprietario || userRole?.nome_funcao === 'Administrativo';
    setCanViewSalaries(canSeeSalaries);
    
    if (isUserProprietario) {
        const allResources = ['empresas', 'empreendimentos', 'funcionarios', 'atividades', 'rdo', 'usuarios', 'permissoes', 'financeiro', 'ponto', 'orcamento', 'pedidos', 'crm', 'contatos', 'simulador', 'contratos', 'caixa-de-entrada', 'anuncios', 'dashboard', 'funil'];
        const allPermissions = allResources.reduce((acc, resource) => {
            acc[resource] = { pode_criar: true, pode_excluir: true, pode_editar: true, pode_ver: true };
            return acc;
        }, {});
        setPermissions(allPermissions);
    } else if (userRole?.id) {
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
        setPermissions({});
    }
    setLoading(false);
  }, [supabase, forceLogout]);

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
    if (isProprietario) return true;
    return permissions[recurso]?.[permissao] || false;
  };

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