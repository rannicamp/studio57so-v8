import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import UserManagementForm from '@/components/configuracoes/UserManagementForm';
import { InviteButton } from './InviteButton'; // <--- AQUI ESTÁ A CORREÇÃO (COM CHAVES)

// Funções de busca de dados iniciais (Server Side)
async function getUsers(organizacaoId) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('usuarios')
        .select(`
            id,
            nome,
            sobrenome,
            email,
            is_active,
            created_at,
            ultimo_acesso,
            avatar_url,
            funcao:funcoes ( id, nome_funcao ),
            funcionario:funcionarios ( id, full_name, cpf )
        `)
        .eq('organizacao_id', organizacaoId)
        .order('nome', { ascending: true });
    
    if (error) {
        console.error('Erro ao buscar usuários:', error);
        return [];
    }
    return data;
}

async function getEmployees(organizacaoId) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('funcionarios')
        .select('id, full_name, cpf')
        .eq('organizacao_id', organizacaoId)
        .order('full_name', { ascending: true });
    
    if (error) return [];
    return data;
}

async function getRoles(organizacaoId) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('funcoes')
        .select('id, nome_funcao')
        .eq('organizacao_id', organizacaoId)
        .order('nome_funcao', { ascending: true });
    
    if (error) return [];
    return data;
}

export default async function UserManagementPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: userProfile, error: userProfileError } = await supabase
        .from('usuarios')
        .select('organizacao_id, funcao:funcoes ( nome_funcao )')
        .eq('id', user.id)
        .single();

    if (userProfileError || !userProfile?.organizacao_id) {
        redirect('/');
    }

    const organizacaoId = userProfile.organizacao_id;

    // Busca paralela para performance
    const [users, employees, roles] = await Promise.all([
        getUsers(organizacaoId),
        getEmployees(organizacaoId),
        getRoles(organizacaoId)
    ]);

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestão de Usuários</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Controle total sobre quem acessa o Studio 57.
                    </p>
                </div>
                
                {/* Botão de Convite Seguro */}
                <InviteButton roles={roles} />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <UserManagementForm
                    initialUsers={users}
                    allEmployees={employees}
                    allRoles={roles}
                    organizationId={organizacaoId}
                />
            </div>
        </div>
    );
}