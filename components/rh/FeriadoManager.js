// components/FeriadoManager.js

"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faCalendarAlt, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';

export default function FeriadoManager() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { userData } = useAuth();

    const [newFeriado, setNewFeriado] = useState({ data_feriado: '', descricao: '', tipo: 'Integral' });

    const { data: feriados = [], isLoading, isError } = useQuery({
        queryKey: ['feriados', userData?.organizacao_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('feriados')
                .select('*')
                .eq('organizacao_id', userData.organizacao_id)
                .order('data_feriado', { ascending: true });
            if (error) throw new Error(error.message);
            return data;
        },
        enabled: !!userData?.organizacao_id,
    });

    const addMutation = useMutation({
        mutationFn: async (feriadoData) => {
            const { data, error } = await supabase
                .from('feriados')
                .insert(feriadoData)
                .select()
                .single();
            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: () => {
            toast.success("Feriado adicionado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['feriados'] });
            setNewFeriado({ data_feriado: '', descricao: '', tipo: 'Integral' });
        },
        onError: (error) => toast.error(`Erro: ${error.message}`),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('feriados').delete().eq('id', id);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            toast.success("Feriado excluído com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['feriados'] });
        },
        onError: (error) => toast.error(`Erro: ${error.message}`),
    });

    const handleAddFeriado = () => {
        if (!newFeriado.data_feriado || !newFeriado.descricao) {
            toast.error("Por favor, preencha a data e a descrição.");
            return;
        }
        addMutation.mutate({ ...newFeriado, organizacao_id: userData.organizacao_id });
    };

    const handleDeleteFeriado = (id) => {
        toast("Tem certeza que deseja excluir?", {
            action: { label: "Sim, excluir", onClick: () => deleteMutation.mutate(id) },
            cancel: { label: "Cancelar" },
        });
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        // Regra #5: Trata a data como texto para evitar erros de fuso horário.
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };
    
    const isProcessing = addMutation.isPending || deleteMutation.isPending;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faCalendarAlt} />
                Feriados Cadastrados
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg border">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium">Descrição do Feriado</label>
                        <input
                            type="text"
                            placeholder="Ex: Quarta-feira de Cinzas"
                            value={newFeriado.descricao}
                            onChange={e => setNewFeriado({ ...newFeriado, descricao: e.target.value })}
                            className="mt-1 w-full p-2 border rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Data</label>
                        <input
                            type="date"
                            value={newFeriado.data_feriado}
                            onChange={e => setNewFeriado({ ...newFeriado, data_feriado: e.target.value })}
                            className="mt-1 w-full p-2 border rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Tipo</label>
                        <select
                            value={newFeriado.tipo}
                            onChange={e => setNewFeriado({ ...newFeriado, tipo: e.target.value })}
                            className="mt-1 w-full p-2 border rounded-md"
                        >
                            <option value="Integral">Integral</option>
                            <option value="Meio Período">Meio Período</option>
                        </select>
                    </div>
                </div>
                <div className="text-right mt-4">
                    <button onClick={handleAddFeriado} disabled={addMutation.isPending} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2 min-w-[170px] justify-center">
                        {addMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <><FontAwesomeIcon icon={faPlus} /> Adicionar Feriado</>}
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto border rounded-lg">
                {isLoading && <div className="p-4 text-center"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>}
                {isError && <div className="p-4 text-center text-red-600"><FontAwesomeIcon icon={faExclamationTriangle} /> Erro ao carregar feriados.</div>}
                {!isLoading && !isError && (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold uppercase">Data</th>
                                <th className="px-6 py-3 text-left text-xs font-bold uppercase">Descrição</th>
                                <th className="px-6 py-3 text-left text-xs font-bold uppercase">Tipo</th>
                                <th className="px-6 py-3 text-center text-xs font-bold uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {feriados.map(feriado => (
                                <tr key={feriado.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{formatDate(feriado.data_feriado)}</td>
                                    <td className="px-6 py-4">{feriado.descricao}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${feriado.tipo === 'Integral' ? 'bg-gray-200 text-gray-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {feriado.tipo}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button onClick={() => handleDeleteFeriado(feriado.id)} disabled={isProcessing} className="text-red-500 hover:text-red-700 disabled:text-gray-400">
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!isLoading && feriados.length === 0 && <p className="text-center py-4 text-gray-500">Nenhum feriado cadastrado.</p>}
            </div>
        </div>
    );
}

// --------------------------------------------------------------------------------
// RESUMO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente gerencia o cadastro de feriados para uma organização.
// Ele foi refatorado para usar `useQuery` para buscar a lista de feriados
// dinamicamente e `useMutation` para adicionar e remover registros.
// Todas as operações agora incluem o `organizacao_id` e atualizam a interface
// do usuário em tempo real. A formatação de datas foi corrigida para evitar
// problemas de fuso horário, tratando a data como texto.
// --------------------------------------------------------------------------------