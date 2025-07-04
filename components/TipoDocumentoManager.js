"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faPen, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function TipoDocumentoManager({ initialData }) {
    const supabase = createClient();
    const [tipos, setTipos] = useState(initialData || []);
    const [newTipo, setNewTipo] = useState({ sigla: '', descricao: '' });
    const [editingId, setEditingId] = useState(null);
    const [editingData, setEditingData] = useState({ sigla: '', descricao: '' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSaveNew = async () => {
        if (!newTipo.sigla || !newTipo.descricao) {
            setMessage("Sigla e Descrição são obrigatórias.");
            return;
        }
        setLoading(true);
        const { data, error } = await supabase.from('documento_tipos').insert(newTipo).select().single();
        if (error) {
            setMessage("Erro: " + error.message);
        } else {
            setTipos([...tipos, data]);
            setNewTipo({ sigla: '', descricao: '' });
            setMessage("Tipo de documento adicionado!");
        }
        setLoading(false);
    };

    const handleUpdate = async (id) => {
        setLoading(true);
        const { data, error } = await supabase.from('documento_tipos').update(editingData).eq('id', id).select().single();
        if (error) {
            setMessage("Erro: " + error.message);
        } else {
            setTipos(tipos.map(t => t.id === id ? data : t));
            setEditingId(null);
            setMessage("Tipo de documento atualizado!");
        }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Tem certeza que deseja excluir esta sigla?")) return;
        setLoading(true);
        const { error } = await supabase.from('documento_tipos').delete().eq('id', id);
        if (error) {
            setMessage("Erro: " + error.message);
        } else {
            setTipos(tipos.filter(t => t.id !== id));
            setMessage("Tipo de documento excluído.");
        }
        setLoading(false);
    };

    return (
        <div className="space-y-4">
            {message && <p className="text-center text-sm p-2 bg-blue-50 text-blue-800 rounded-md">{message}</p>}
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
                                            <button onClick={() => handleUpdate(tipo.id)} className="text-green-600 hover:text-green-800 mr-3 disabled:opacity-50" disabled={loading}>{loading ? <FontAwesomeIcon icon={faSpinner} spin/> : 'Salvar'}</button>
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
                        {/* Linha para adicionar novo item */}
                        <tr>
                            <td className="px-6 py-4"><input type="text" placeholder="Ex: CONTR" value={newTipo.sigla} onChange={e => setNewTipo({...newTipo, sigla: e.target.value.toUpperCase()})} className="p-1 border rounded-md w-full"/></td>
                            <td className="px-6 py-4"><input type="text" placeholder="Ex: Contrato de Serviço" value={newTipo.descricao} onChange={e => setNewTipo({...newTipo, descricao: e.target.value})} className="p-1 border rounded-md w-full"/></td>
                            <td className="px-6 py-4 text-center"><button onClick={handleSaveNew} className="bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600 disabled:opacity-50" disabled={loading}><FontAwesomeIcon icon={faPlus}/> Adicionar</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}