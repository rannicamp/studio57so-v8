// Local do Arquivo: contexts/AuthContext.js

"use client";

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const supabase = createClient();
    const router = useRouter();
    
    // =================================================================================
    // MUDANÇA PRINCIPAL
    // O PORQUÊ: Agora teremos um único 'user' que será o objeto COMPLETO,
    // combinando os dados de autenticação com os dados do nosso banco (public.usuarios).
    // O 'userData' não será mais exposto diretamente, para evitar confusão.
    // =================================================================================
    const [user, setUser] = useState(null); // Este será o nosso usuário unificado.
    const [loading, setLoading] = useState(true);
    const [isProprietario, setIsProprietario] = useState(false);
    const [permissions, setPermissions] = useState({});
    
    // O organizacao_id agora é um estado de primeiro nível para fácil acesso
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
        
        // =================================================================================
        // A MÁGICA ACONTECE AQUI!
        // O PORQUÊ: Estamos combinando o usuário da autenticação (currentUser) com o
        // nosso perfil do banco (profileData) em um único objeto.
        // =================================================================================
        const combinedUser = {
            ...currentUser, // Dados de auth: id, email, etc.
            ...profileData, // Nossos dados: nome, funcao, e o mais importante, organizacao_id!
        };

        setUser(combinedUser);
        setOrganizacaoId(profileData.organizacao_id); // Armazena a organização para acesso rápido
        
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
            // A gente não seta o 'user' aqui diretamente mais, a função fetch cuida disso.
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
    
    // O 'value' agora fornece o 'user' unificado e o 'organizacao_id' de fácil acesso.
    const value = { user, loading, isProprietario, permissions, hasPermission, organizacao_id };
    
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
}