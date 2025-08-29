"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function FeriadoManager({ initialFeriados }) {
    const supabase = createClient();
    const [feriados, setFeriados] = useState(initialFeriados || []);
    // Estado inicial agora inclui o campo 'tipo'
    const [newFeriado, setNewFeriado] = useState({ data_feriado: '', descricao: '', tipo: 'Integral' });
    const [loading, setLoading] = useState(false);

    const handleAddFeriado = async () => {
        if (!newFeriado.data_feriado || !newFeriado.descricao) {
            toast.error("Por favor, preencha a data e a descrição do feriado.");
            return;
        }

        setLoading(true);
        const promise = supabase.from('feriados').insert(newFeriado).select().single();

        toast.promise(promise, {
            loading: 'Adicionando feriado...',
            success: (response) => {
                if (response.error) throw new Error(response.error.message);
                setFeriados(prev => [...prev, response.data].sort((a, b) => new Date(a.data_feriado) - new Date(b.data_feriado)));
                setNewFeriado({ data_feriado: '', descricao: '', tipo: 'Integral' }); // Reseta o formulário
                return "Feriado adicionado com sucesso!";
            },
            error: (err) => `Erro: ${err.message}`,
            finally: () => setLoading(false)
        });
    };

    const handleDeleteFeriado = async (id) => {
        if (!window.confirm("Tem certeza que deseja excluir este feriado?")) return;

        setLoading(true);
        const promise = supabase.from('feriados').delete().eq('id', id);

        toast.promise(promise, {
            loading: 'Excluindo feriado...',
            success: () => {
                setFeriados(prev => prev.filter(f => f.id !== id));
                return "Feriado excluído com sucesso!";
            },
            error: (err) => `Erro: ${err.message}`,
            finally: () => setLoading(false)
        });
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faCalendarAlt} />
                Feriados Cadastrados
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg border">
                {/* Formulário de adição agora tem o campo 'Tipo' */}
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
                    <button onClick={handleAddFeriado} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400">
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <><FontAwesomeIcon icon={faPlus} /> Adicionar Feriado</>}
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto border rounded-lg">
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
                                <td className="px-6 py-4 whitespace-nowrap">{new Date(feriado.data_feriado + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                                <td className="px-6 py-4">{feriado.descricao}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${feriado.tipo === 'Integral' ? 'bg-gray-200 text-gray-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {feriado.tipo}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button onClick={() => handleDeleteFeriado(feriado.id)} disabled={loading} className="text-red-500 hover:text-red-700">
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {feriados.length === 0 && <p className="text-center py-4 text-gray-500">Nenhum feriado cadastrado.</p>}
            </div>
        </div>
    );
}