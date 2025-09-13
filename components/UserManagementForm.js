//components\UserManagementForm.js
"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faTimes, faUserShield, faSave } from '@fortawesome/free-solid-svg-icons';

// --- Sub-componente para o Modal de Gestão de Funções ---
const RolesManagerModal = ({ isOpen, onClose, initialRoles, onRolesUpdate }) => {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();

    const [roles, setRoles] = useState(initialRoles);
    const [newRoleName, setNewRoleName] = useState('');

    const addRoleMutation = useMutation({
        mutationFn: async (roleName) => {
            if (!roleName.trim()) throw new Error("O nome da função não pode estar vazio.");
            if (!organizacaoId) throw new Error("Organização não identificada.");
            
            const { data, error } = await supabase
                .from('funcoes')
                .insert({ nome_funcao: roleName, organizacao_id: organizacaoId }) // <-- A ETIQUETA DE SEGURANÇA!
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (newRole) => {
            const updatedRoles = [...roles, newRole];
            setRoles(updatedRoles);
            onRolesUpdate(updatedRoles);
            setNewRoleName('');
            queryClient.invalidateQueries({ queryKey: ['allRoles', organizacaoId] });
        }
    });

    const deleteRoleMutation = useMutation({
        mutationFn: async (roleId) => {
            const { error } = await supabase.from('funcoes').delete().eq('id', roleId);
            if (error) throw error;
            return roleId;
        },
        onSuccess: (deletedId) => {
            const updatedRoles = roles.filter(r => r.id !== deletedId);
            setRoles(updatedRoles);
            onRolesUpdate(updatedRoles);
            queryClient.invalidateQueries({ queryKey: ['allRoles', organizacaoId] });
        }
    });

    const handleAddRole = () => {
        toast.promise(addRoleMutation.mutateAsync(newRoleName), {
            loading: 'Adicionando função...',
            success: 'Função adicionada com sucesso!',
            error: (err) => err.message
        });
    };

    const handleDeleteRole = (roleId) => {
        toast("Confirmar Exclusão", {
            description: "Atenção: Excluir esta função pode afetar os usuários associados a ela. Deseja continuar?",
            action: {
                label: "Excluir",
                onClick: () => toast.promise(deleteRoleMutation.mutateAsync(roleId), {
                    loading: 'Excluindo...',
                    success: 'Função excluída com sucesso!',
                    error: (err) => `Erro ao excluir: ${err.message}`
                }),
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };
    
    if (!isOpen) return null;
    const isMutating = addRoleMutation.isPending || deleteRoleMutation.isPending;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Gerenciar Funções</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                </div>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            placeholder="Nome da nova função"
                            className="flex-grow p-2 border rounded-md"
                        />
                        <button onClick={handleAddRole} disabled={isMutating} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {addRoleMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} />}
                        </button>
                    </div>
                    <ul className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-2">
                        {roles.map(role => (
                            <li key={role.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <span className="font-medium">{role.nome_funcao}</span>
                                {role.nome_funcao !== 'Proprietário' && (
                                    <button onClick={() => handleDeleteRole(role.id)} disabled={isMutating} className="text-red-500 hover:text-red-700">
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

// --- Componente Principal ---
export default function UserManagementForm({ initialUsers, allEmployees, allRoles }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [users, setUsers] = useState(initialUsers);
    const [roles, setRoles] = useState(allRoles);
    const [editingUserId, setEditingUserId] = useState(null);
    const [formData, setFormData] = useState({});
    const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);

    const saveUserMutation = useMutation({
        mutationFn: async (updateData) => {
            const { id, ...dataToSave } = updateData;
            const { error } = await supabase.from('usuarios').update(dataToSave).eq('id', id);
            if (error) throw error;
            return updateData;
        },
        onSuccess: (updatedData) => {
            setEditingUserId(null);
            setUsers(prevUsers => prevUsers.map(user =>
                user.id === updatedData.id ? { 
                    ...user, 
                    ...updatedData,
                    funcionario: allEmployees.find(emp => emp.id == updatedData.funcionario_id) || null,
                    funcao: roles.find(role => role.id == updatedData.funcao_id) || null,
                } : user
            ));
            queryClient.invalidateQueries({ queryKey: ['allUsers', organizacaoId] });
        }
    });

    const handleEditClick = (user) => {
        setEditingUserId(user.id);
        setFormData({
            ...user,
            funcionario_id: user.funcionario_id || '',
            funcao_id: user.funcao?.id || '',
            is_active: user.is_active,
        });
    };

    const handleCancelEdit = () => {
        setEditingUserId(null);
        setFormData({});
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (value === '' ? null : value)
        }));
    };

    const handleSaveUser = () => {
        const { id, nome, sobrenome, email, funcionario_id, is_active, funcao_id } = formData;
        const updateData = { id, nome, sobrenome, email, funcionario_id: funcionario_id || null, is_active, funcao_id: funcao_id || null };

        toast.promise(saveUserMutation.mutateAsync(updateData), {
            loading: 'Salvando usuário...',
            success: 'Usuário salvo com sucesso!',
            error: (err) => `Erro ao salvar: ${err.message}`,
        });
    };

    return (
        <div className="space-y-6">
            <RolesManagerModal
                isOpen={isRolesModalOpen}
                onClose={() => setIsRolesModalOpen(false)}
                initialRoles={roles}
                onRolesUpdate={(updatedRoles) => setRoles(updatedRoles)}
            />

            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Lista de Usuários Cadastrados</h2>
                <button
                    onClick={() => setIsRolesModalOpen(true)}
                    className="bg-gray-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-gray-700 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faUserShield} />
                    Gerenciar Funções
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
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id}>
                                {editingUserId === user.id ? (
                                    <>
                                        <td className="px-6 py-4 whitespace-nowrap"><input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} className="p-2 border rounded-md w-full text-sm"/></td>
                                        <td className="px-6 py-4 whitespace-nowrap"><input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="p-2 border rounded-md w-full text-sm"/></td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <select name="funcionario_id" value={formData.funcionario_id || ''} onChange={handleChange} className="p-2 border rounded-md w-full text-sm">
                                                <option value="">Nenhum</option>
                                                {allEmployees.map(emp => (
                                                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <select name="funcao_id" value={formData.funcao_id || ''} onChange={handleChange} className="p-2 border rounded-md w-full text-sm">
                                                <option value="">Nenhuma</option>
                                                {roles.map(role => (
                                                    <option key={role.id} value={role.id}>{role.nome_funcao}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <input type="checkbox" name="is_active" checked={formData.is_active || false} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={handleSaveUser} disabled={saveUserMutation.isPending} className="text-green-600 hover:text-green-900 mr-4">
                                                {saveUserMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                                            </button>
                                            <button onClick={handleCancelEdit} className="text-gray-600 hover:text-gray-900">Cancelar</button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.nome} {user.sobrenome}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.funcionario?.full_name || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.funcao?.nome_funcao || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{user.is_active ? 'Sim' : 'Não'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleEditClick(user)} className="text-blue-600 hover:text-blue-900">Editar</button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}