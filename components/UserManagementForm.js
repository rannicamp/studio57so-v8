// components/UserManagementForm.js
"use client";

import { useState, useRef } from 'react';
import { createUser } from '@/app/(main)/configuracoes/usuarios/actions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

// --- Função para buscar os usuários (será usada pelo React Query no navegador) ---
const fetchUsers = async (organizationId) => {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('usuarios')
        .select(`
            id,
            nome,
            sobrenome,
            email,
            is_active,
            funcao:funcoes ( id, nome_funcao ),
            funcionario:funcionarios ( id, full_name, cpf )
        `)
        .eq('organizacao_id', organizationId)
        .order('nome', { ascending: true });

    if (error) {
        throw new Error('Não foi possível buscar os usuários.');
    }
    return data;
};

// --- Sub-componente para o Modal de Novo Usuário ---
const AddUserModal = ({ isOpen, onClose, allRoles, allEmployees, organizationId }) => {
    const queryClient = useQueryClient();
    const formRef = useRef(null);

    // useMutation para CRIAR o usuário de forma assíncrona
    const { mutate, isPending } = useMutation({
        mutationFn: async (formData) => {
            const result = await createUser(null, formData);
            if (!result.success) {
                // Se a Server Action retornar um erro, nós o lançamos para o onError do useMutation
                throw new Error(result.message);
            }
            return result;
        },
        onSuccess: () => {
            toast.success('Usuário criado com sucesso!');
            // A MÁGICA: Invalida o cache, forçando o useQuery a buscar a lista de usuários atualizada.
            queryClient.invalidateQueries({ queryKey: ['users', organizationId] });
            onClose();
            formRef.current?.reset();
        },
        onError: (error) => {
            // Captura o erro lançado e o exibe
            toast.error(`Erro ao criar usuário: ${error.message}`);
        },
    });

    const handleSubmit = (formData) => {
        mutate(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Adicionar Novo Usuário</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                </div>
                <form ref={formRef} action={handleSubmit}>
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome</label>
                                <input type="text" name="nome" id="nome" required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                            </div>
                            <div>
                                <label htmlFor="sobrenome" className="block text-sm font-medium text-gray-700">Sobrenome</label>
                                <input type="text" name="sobrenome" id="sobrenome" required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                            <input type="email" name="email" id="email" required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label htmlFor="password" aclass="block text-sm font-medium text-gray-700">Senha Provisória</label>
                            <input type="password" name="password" id="password" required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label htmlFor="funcao_id" className="block text-sm font-medium text-gray-700">Função</label>
                            <select name="funcao_id" id="funcao_id" required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                {allRoles.map(role => (
                                    <option key={role.id} value={role.id}>{role.nome_funcao}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="funcionario_id" className="block text-sm font-medium text-gray-700">Vincular Funcionário (Opcional)</label>
                            <select name="funcionario_id" id="funcionario_id" className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                <option value="">Nenhum</option>
                                {allEmployees.map(employee => (
                                    <option key={employee.id} value={employee.id}>{employee.full_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-6">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300" disabled={isPending}>Cancelar</button>
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2" disabled={isPending}>
                            {isPending ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : 'Salvar Usuário'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Componente Principal ---
export default function UserManagementForm({ initialUsers, allEmployees, allRoles, organizationId }) {
    const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);

    // useQuery para BUSCAR e gerenciar o cache dos usuários
    const { data: users, isLoading, isError } = useQuery({
        queryKey: ['users', organizationId], // Chave única para esta busca de dados
        queryFn: () => fetchUsers(organizationId), // Função que busca os dados
        initialData: initialUsers, // Usa os dados do servidor no primeiro carregamento!
    });

    // Se estiver carregando pela primeira vez (e não tiver dados iniciais)
    if (isLoading && !initialUsers) {
        return <div>Carregando usuários...</div>;
    }

    // Se ocorrer um erro na busca
    if (isError) {
        return <div>Ocorreu um erro ao carregar os usuários. Tente recarregar a página.</div>;
    }

    return (
        <div className="space-y-6">
            <AddUserModal
                isOpen={isAddUserModalOpen}
                onClose={() => setAddUserModalOpen(false)}
                allRoles={allRoles}
                allEmployees={allEmployees}
                organizationId={organizationId}
            />

            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Lista de Usuários</h2>
                <button
                    onClick={() => setAddUserModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Adicionar Novo Usuário
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Funcionário Associado</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Função</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ativo</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users?.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.nome} {user.sobrenome}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.funcionario?.full_name || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.funcao?.nome_funcao || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.is_active ? 'Sim' : 'Não'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}