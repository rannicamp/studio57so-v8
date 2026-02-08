// app/(main)/configuracoes/permissoes/page.js
import { createClient } from '../../../../utils/supabase/server';
import PermissionManager from '../../../../components/PermissionManager';
import { redirect } from 'next/navigation';

export default async function PermissoesPage() {
    const supabase = await createClient();

    // 1. Verifica se o usuário tem permissão para acessar esta página
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    // =================================================================================
    // CORREÇÃO DE SEGURANÇA (organização_id)
    // O PORQUÊ: Além de verificar a função, agora também pegamos o `organizacao_id`
    // do usuário. Ele será nossa "chave mestra" para filtrar os dados.
    // =================================================================================
    const { data: adminData } = await supabase
        .from('usuarios')
        .select('funcao_id, organizacao_id, funcoes(nome_funcao)') // <-- Pegamos o organizacao_id
        .eq('id', user.id)
        .single();

    // Apenas 'Proprietário' pode ver esta página. Redireciona se não for ou se não encontrar o usuário.
    if (!adminData || adminData.funcoes?.nome_funcao !== 'Proprietário') {
        redirect('/');
    }
    
    const organizacaoId = adminData.organizacao_id;

    // =================================================================================
    // CORREÇÃO DE SEGURANÇA (organização_id)
    // O PORQUÊ: Adicionamos o filtro `.eq('organizacao_id', organizacaoId)` para
    // garantir que o Proprietário só veja e gerencie as funções e permissões
    // da SUA PRÓPRIA organização.
    // =================================================================================
    const { data: funcoes, error: funcoesError } = await supabase
        .from('funcoes')
        .select(`
            *,
            permissoes(*)
        `)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('id');

    if (funcoesError) {
        console.error("Erro ao buscar funções e permissões:", funcoesError);
        return <p className="p-4 text-red-500">Erro ao carregar os dados de permissão.</p>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Permissões</h1>
            <p className="text-gray-600">
                Marque as caixas para definir o que cada função de usuário pode ver, criar, editar ou excluir no sistema.
            </p>
            
            <div className="bg-white rounded-lg shadow p-6">
                {/* O componente agora receberá apenas as funções da organização correta */}
                <PermissionManager initialFuncoes={funcoes || []} />
            </div>
        </div>
    );
}