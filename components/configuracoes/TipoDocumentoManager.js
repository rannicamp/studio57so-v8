//components\TipoDocumentoManager.js
"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faPen, faSpinner, faSave } from '@fortawesome/free-solid-svg-icons';

export default function TipoDocumentoManager({ initialData }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [tipos, setTipos] = useState(initialData || []);
    const [newTipo, setNewTipo] = useState({ sigla: '', descricao: '' });
    const [editingId, setEditingId] = useState(null);
    const [editingData, setEditingData] = useState({ sigla: '', descricao: '' });
    
    // Função de sucesso para invalidar o cache e recarregar os dados
    const handleSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['documento_tipos', organizacaoId] });
    };

    // =================================================================================
    // FUNDAÇÃO REFORÇADA E ACABAMENTO DE LUXO
    // O PORQUÊ: Usamos useMutation para padronizar a criação, atualização e exclusão.
    // Isso centraliza a lógica, remove a necessidade de `useState` para loading/message
    // e permite usar `toast.promise` para um feedback claro e elegante.
    // A `organizacao_id` é a nossa "etiqueta de segurança" na criação.
    // =================================================================================
    const addMutation = useMutation({
        mutationFn: async (newTipoData) => {
            if (!newTipoData.sigla || !newTipoData.descricao) throw new Error("Sigla e Descrição são obrigatórias.");
            if (!organizacaoId) throw new Error("Organização não identificada.");
            
            const { data, error } = await supabase
                .from('documento_tipos')
                .insert({ ...newTipoData, organizacao_id: organizacaoId }) // <-- A ETIQUETA DE SEGURANÇA!
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            setTipos([...tipos, data]);
            setNewTipo({ sigla: '', descricao: '' });
            handleSuccess();
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            const { data: updatedData, error } = await supabase
                .from('documento_tipos')
                .update(data)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return updatedData;
        },
        onSuccess: (data) => {
            setTipos(tipos.map(t => t.id === data.id ? data : t));
            setEditingId(null);
            handleSuccess();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('documento_tipos').delete().eq('id', id);
            if (error) throw error;
            return id;
        },
        onSuccess: (id) => {
            setTipos(tipos.filter(t => t.id !== id));
            handleSuccess();
        },
    });

    const handleSaveNew = () => {
        toast.promise(addMutation.mutateAsync(newTipo), {
            loading: 'Adicionando tipo...',
            success: 'Tipo de documento adicionado com sucesso!',
            error: (err) => err.message,
        });
    };

    const handleUpdate = (id) => {
        toast.promise(updateMutation.mutateAsync({ id, data: editingData }), {
            loading: 'Atualizando tipo...',
            success: 'Tipo de documento atualizado com sucesso!',
            error: (err) => err.message,
        });
    };

    const handleDelete = (id) => {
        toast("Confirmar Exclusão", {
            description: "Tem certeza que deseja excluir este tipo de documento?",
            action: {
                label: "Excluir",
                onClick: () => toast.promise(deleteMutation.mutateAsync(id), {
                    loading: 'Excluindo...',
                    success: 'Tipo de documento excluído com sucesso!',
                    error: (err) => `Erro ao excluir: ${err.message}`,
                }),
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' },
        });
    };
    
    const isMutating = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold uppercase">Sigla</th>
                            <th className="px-6 py-3 text-left text-xs font-bold uppercase">Descrição</th>
                            <th className="px-6 py-3 text-center text-xs font-bold uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {tipos.map(tipo => (
                            <tr key={tipo.id}>
                                {editingId === tipo.id ? (
                                    <>
                                        <td className="px-6 py-4"><input type="text" value={editingData.sigla} onChange={e => setEditingData({...editingData, sigla: e.target.value.toUpperCase()})} className="p-1 border rounded-md w-full"/></td>
                                        <td className="px-6 py-4"><input type="text" value={editingData.descricao} onChange={e => setEditingData({...editingData, descricao: e.target.value})} className="p-1 border rounded-md w-full"/></td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => handleUpdate(tipo.id)} className="text-green-600 hover:text-green-800 mr-3 disabled:opacity-50" disabled={isMutating}>
                                                {updateMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin/> : <FontAwesomeIcon icon={faSave} />}
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700">Cancelar</button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-6 py-4 font-mono font-semibold">{tipo.sigla}</td>
                                        <td className="px-6 py-4">{tipo.descricao}</td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => { setEditingId(tipo.id); setEditingData(tipo); }} className="text-blue-500 hover:text-blue-700 mr-3"><FontAwesomeIcon icon={faPen}/></button>
                                            <button onClick={() => handleDelete(tipo.id)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash}/></button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                        <tr>
                            <td className="px-6 py-4"><input type="text" placeholder="Ex: CONTR" value={newTipo.sigla} onChange={e => setNewTipo({...newTipo, sigla: e.target.value.toUpperCase()})} className="p-1 border rounded-md w-full"/></td>
                            <td className="px-6 py-4"><input type="text" placeholder="Ex: Contrato de Serviço" value={newTipo.descricao} onChange={e => setNewTipo({...newTipo, descricao: e.target.value})} className="p-1 border rounded-md w-full"/></td>
                            <td className="px-6 py-4 text-center">
                                <button onClick={handleSaveNew} className="bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600 disabled:opacity-50 flex items-center gap-2" disabled={isMutating}>
                                    {addMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus}/>}
                                    {addMutation.isPending ? '...' : 'Adicionar'}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}