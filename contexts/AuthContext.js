// Local do Arquivo: contexts/AuthContext.js

"use client";

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const supabase = createClient();
    const router = useRouter();
    
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isProprietario, setIsProprietario] = useState(false);
    const [permissions, setPermissions] = useState({});
    const [organizacao_id, setOrganizacaoId] = useState(null);

    const forceLogout = useCallback(async () => {
        await supabase.auth.signOut();
        setUser(null);
        setPermissions({});
        setIsProprietario(false);
        setOrganizacaoId(null);
        setLoading(false);
        router.push('/login?error=Sessão inválida ou usuário não encontrado.');
    }, [supabase, router]);

    const fetchProfileAndPermissions = useCallback(async (currentUser) => {
        if (!currentUser) {
            setUser(null);
            setPermissions({});
            setIsProprietario(false);
            setOrganizacaoId(null);
            setLoading(false);
            return;
        }

        setLoading(true);

        const { data: profileData, error } = await supabase
            .from('usuarios')
            .select('*, funcoes ( id, nome_funcao )')
            .eq('id', currentUser.id)
            .single();

        if (error || !profileData) {
            console.error("URGENTE: Usuário da sessão não foi encontrado na tabela 'usuarios'. Forçando logout.", error);
            await forceLogout();
            return;
        }
        
        const combinedUser = {
            ...currentUser,
            ...profileData,
        };

        setUser(combinedUser);
        setOrganizacaoId(profileData.organizacao_id);
        
        const userRole = profileData?.funcoes;
        const isUserProprietario = userRole?.nome_funcao === 'Proprietário';
        setIsProprietario(isUserProprietario);
        
        if (isUserProprietario) {
            const allResources = ['empresas', 'empreendimentos', 'funcionarios', 'atividades', 'rdo', 'usuarios', 'permissoes', 'financeiro', 'ponto', 'orcamento', 'pedidos', 'crm', 'contatos', 'simulador', 'contratos', 'caixa-de-entrada', 'anuncios', 'dashboard', 'funil'];
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
        setLoading(false);
    }, [supabase, forceLogout]);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user;
            fetchProfileAndPermissions(currentUser);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase, fetchProfileAndPermissions]);
    
    const refreshAuthUser = useCallback(async () => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
            await fetchProfileAndPermissions(currentUser);
        }
    }, [supabase, fetchProfileAndPermissions]);


    const hasPermission = (recurso, permissao) => {
        if (isProprietario) return true;
        return permissions[recurso]?.[permissao] || false;
    };
    
    // =================================================================================
    // AQUI ESTÁ A CORREÇÃO MÁGICA
    // O PORQUÊ: Adicionamos a propriedade 'userData' que é um espelho da 'user'.
    // Isso garante que componentes antigos que usam 'user' continuem funcionando,
    // e o novo ContatoForm que usa 'userData' também funcione. É a solução mais segura.
    // =================================================================================
    const value = { 
        user, 
        userData: user, // <-- A CORREÇÃO ESTÁ AQUI
        loading, 
        isProprietario, 
        permissions, 
        hasPermission, 
        organizacao_id, 
        refreshAuthUser 
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