'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// USO DE @/ PARA EVITAR ERROS DE CAMINHO
import { createClient } from '@/utils/supabase/client'; 
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faPen, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function CargosManager() {
    const supabase = createClient();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const organizacao_id = user?.organizacao_id;

    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [newName, setNewName] = useState('');

    // Buscar Cargos
    const { data: cargos = [], isLoading } = useQuery({
        queryKey: ['cargos', organizacao_id],
        queryFn: async () => {
            if (!organizacao_id) return [];
            const { data, error } = await supabase
                .from('cargos')
                .select('*')
                .eq('organizacao_id', organizacao_id)
                .order('nome');
            if (error) throw error;
            return data;
        },
        enabled: !!organizacao_id
    });

    // Criar Cargo
    const createMutation = useMutation({
        mutationFn: async (nome) => {
            const { error } = await supabase.from('cargos').insert({ nome, organizacao_id });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['cargos']);
            setNewName('');
            toast.success('Cargo criado!');
        },
        onError: (err) => toast.error('Erro ao criar: ' + err.message)
    });

    // Editar Cargo
    const updateMutation = useMutation({
        mutationFn: async ({ id, nome }) => {
            const { error } = await supabase.from('cargos').update({ nome }).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['cargos']);
            setEditingId(null);
            toast.success('Cargo atualizado!');
        },
        onError: (err) => toast.error('Erro ao editar: ' + err.message)
    });

    // Excluir Cargo
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            // Verifica se tem uso na tabela de funcionários
            const { count } = await supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('cargo_id', id);
            if (count > 0) throw new Error(`Este cargo está vinculado a ${count} funcionários. Não pode ser excluído.`);
            
            const { error } = await supabase.from('cargos').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['cargos']);
            toast.success('Cargo removido.');
        },
        onError: (err) => toast.error(err.message)
    });

    const handleEdit = (cargo) => {
        setEditingId(cargo.id);
        setEditName(cargo.nome);
    };

    const handleSaveEdit = () => {
        if (!editName.trim()) return;
        updateMutation.mutate({ id: editingId, nome: editName });
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Cargos e Funções</h2>
                    <p className="text-sm text-gray-500">Defina os cargos disponíveis para os contratos de trabalho.</p>
                </div>
            </div>

            {/* Adicionar Novo */}
            <div className="flex gap-2 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <input 
                    type="text" 
                    placeholder="Nome do novo cargo (ex: Gerente Comercial)" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
                />
                <button 
                    onClick={() => newName && createMutation.mutate(newName)}
                    disabled={createMutation.isPending || !newName}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center"
                >
                    {createMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} className="mr-2"/>}
                    Adicionar
                </button>
            </div>

            {/* Lista */}
            {isLoading ? (
                <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-300"/></div>
            ) : (
                <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome do Cargo</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {cargos.map((cargo) => (
                                <tr key={cargo.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {editingId === cargo.id ? (
                                            <input 
                                                autoFocus
                                                type="text" 
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                onBlur={handleSaveEdit}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                                                className="w-full border-blue-300 rounded p-1 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        ) : (
                                            <span className="text-gray-900 font-medium">{cargo.nome}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                        <button 
                                            onClick={() => handleEdit(cargo)}
                                            className="text-blue-600 hover:text-blue-900 p-1"
                                            title="Renomear"
                                        >
                                            <FontAwesomeIcon icon={faPen} />
                                        </button>
                                        <button 
                                            onClick={() => { if(confirm('Tem certeza?')) deleteMutation.mutate(cargo.id) }}
                                            className="text-red-600 hover:text-red-900 p-1"
                                            title="Excluir"
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {cargos.length === 0 && (
                                <tr>
                                    <td colSpan="2" className="px-6 py-8 text-center text-gray-500">Nenhum cargo cadastrado. Comece adicionando um acima.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}