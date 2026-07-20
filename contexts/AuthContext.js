// Local do Arquivo: contexts/AuthContext.js

"use client";

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isProprietario, setIsProprietario] = useState(false);
    const [permissions, setPermissions] = useState({});
    const [organizacao_id, setOrganizacaoId] = useState(null);

    const forceLogout = useCallback(async () => {
        if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            const isAuthRoute = path.startsWith('/atualizar-senha') || 
                                path.startsWith('/recuperar-senha') || 
                                path.startsWith('/cadastro');
            
            if (isAuthRoute) {
                console.warn("AuthContext: Evitando forceLogout/redirecionamento porque o usuário está em uma rota pública de autenticação.");
                setLoading(false);
                return;
            }
        }

        try {
            queryClient.clear();
        } catch (e) {
            console.error("Erro ao limpar cache do TanStack Query no forceLogout:", e);
        }

        await supabase.auth.signOut();
        setUser(null);
        setPermissions({});
        setIsProprietario(false);
        setOrganizacaoId(null);
        
        // Limpa os cookies de controle do middleware
        if (typeof window !== 'undefined') {
            document.cookie = "sys_user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            document.cookie = "sys_is_admin=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        }
        setLoading(false);
        router.push('/login?error=Sessão inválida ou usuário não encontrado.');
    }, [supabase, router, queryClient]);

    const fetchProfileAndPermissions = useCallback(async (currentUser) => {
        if (!currentUser) {
            setUser(null);
            setPermissions({});
            setIsProprietario(false);
            setOrganizacaoId(null);
            setLoading(false);
            return;
        }

        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/atualizar-senha')) {
            console.log("AuthContext: Ignorando busca de perfil no /atualizar-senha para evitar conflito de sessão.");
            setUser(currentUser);
            setLoading(false);
            return;
        }

        setLoading(true);

        const { data: profileData, error } = await supabase
            .from('usuarios')
            .select('*, funcoes ( id, nome_funcao ), organizacoes ( plano_codigo, seats_contracted )')
            .eq('id', currentUser.id)
            .single();

        if (error || !profileData) {
            console.error("URGENTE: Usuário da sessão não foi encontrado na tabela 'usuarios'. Forçando logout.", error);
            await forceLogout();
            return;
        }

        // Sincroniza os cookies de acesso com o navegador para o middleware
        if (typeof window !== 'undefined') {
            document.cookie = `sys_user_role=${profileData.funcao_id || ''}; path=/; max-age=${60 * 30}; SameSite=Lax`;
            document.cookie = `sys_is_admin=${profileData.is_superadmin ? 'true' : 'false'}; path=/; max-age=${60 * 30}; SameSite=Lax`;
        }

        // Buscar dados extras (CRECI, Telefone) na tabela de Contatos associada ao usuário (Corretores)
        const { data: contatoData } = await supabase
            .from('contatos')
            .select('id, creci')
            .eq('criado_por_usuario_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let telefoneContato = '';
        if (contatoData && contatoData.id) {
            const { data: telData } = await supabase
                .from('telefones')
                .select('telefone')
                .eq('contato_id', contatoData.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (telData) telefoneContato = telData.telefone;
        }

        // Fallback: Buscar também em Funcionários caso seja um vendedor interno CLT
        const { data: funcionarioData } = await supabase
            .from('funcionarios')
            .select('phone')
            .eq('email', currentUser.email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Buscar permissões de módulos do plano da organização
        let planoModulos = null;
        if (profileData?.organizacoes?.plano_codigo) {
            const { data: planoData } = await supabase
                .from('planos')
                .select('modulos_inclusos')
                .eq('codigo', profileData.organizacoes.plano_codigo)
                .maybeSingle();
            if (planoData) planoModulos = planoData.modulos_inclusos;
        }

        const fallbackModulos = {
            essencial: { painel: true, financeiro: true, empresas: true, empreendimentos: true, contatos: true, simulador: true, atividades: true, contratos: true },
            pro: { painel: true, financeiro: true, empresas: true, empreendimentos: true, contatos: true, simulador: true, atividades: true, contratos: true, recursos_humanos: true, crm: true, tabela_vendas: true, orcamento: true, pedidos: true, almoxarifado: true, rdo: true, bim: true, relatorios: true, caixa_de_entrada: true },
            ia: { painel: true, financeiro: true, empresas: true, empreendimentos: true, contatos: true, simulador: true, atividades: true, contratos: true, recursos_humanos: true, crm: true, tabela_vendas: true, orcamento: true, pedidos: true, almoxarifado: true, rdo: true, bim: true, relatorios: true, inteligencia_artificial: true, caixa_de_entrada: true }
        };
        const activePlan = profileData?.organizacoes?.plano_codigo || 'essencial';
        const modulosPermitidos = planoModulos || fallbackModulos[activePlan] || fallbackModulos['essencial'];

        const combinedUser = {
            ...currentUser,
            ...profileData,
            nome_funcao: profileData?.funcoes?.nome_funcao || '',
            funcao: profileData?.funcoes?.nome_funcao || '',
            telefone: telefoneContato || funcionarioData?.phone || '',
            creci: contatoData?.creci || '',
            plano_codigo: activePlan,
            modulos_permitidos: modulosPermitidos,
            seats_contracted: profileData?.organizacoes?.seats_contracted || 1
        };

        setUser(combinedUser);
        setOrganizacaoId(profileData.organizacao_id);

        const userRole = profileData?.funcoes;
        const isUserProprietario = userRole?.nome_funcao === 'Proprietário' || profileData?.is_superadmin === true;
        setIsProprietario(isUserProprietario);

        if (isUserProprietario) {
            const allResources = ['painel', 'financeiro', 'recursos_humanos', 'funcionarios', 'funcionarios_salario_debug', 'ponto', 'empresas', 'empreendimentos', 'contratos', 'relatorios', 'caixa_de_entrada', 'crm', 'tabela_vendas', 'anuncios', 'contatos', 'simulador', 'orcamento', 'pedidos', 'almoxarifado', 'rdo', 'atividades', 'bim', 'usuarios', 'permissoes', 'config_usuarios', 'config_permissoes', 'config_jornadas', 'config_tipos_documento', 'config_integracoes', 'config_materiais', 'config_treinamento_ia', 'config_kpi_builder', 'config_financeiro_importar', 'config_menu'];
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
            console.warn("Usuário sem função. Limpando permissões.", profileData);
            setPermissions({});
        }
        setLoading(false);
    }, [supabase, forceLogout]);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user;
            if (!currentUser) {
                try {
                    queryClient.clear();
                } catch (e) {
                    console.error("Erro ao limpar cache do TanStack Query no onAuthStateChange:", e);
                }
            }
            fetchProfileAndPermissions(currentUser);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase, fetchProfileAndPermissions, queryClient]);

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

    const hasModuleAccess = useCallback((modulo) => {
        if (!user) return false;
        if (user.is_superadmin || user.organizacao_id === 1) return true;
        return user.modulos_permitidos?.[modulo] === true;
    }, [user]);

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
        hasModuleAccess,
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