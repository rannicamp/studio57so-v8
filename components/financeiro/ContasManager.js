"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faUniversity, faCreditCard, faMoneyBillWave, faChartLine, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import ContaFormModal from './ContaFormModal'; // Esta linha precisa que o ContaFormModal.js também esteja na mesma pasta

export default function ContasManager() {
    const supabase = createClient();
    const [contas, setContas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConta, setEditingConta] = useState(null);
    const [message, setMessage] = useState('');
    
    const fetchContas = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('contas_financeiras')
            .select('*, empresa:empresa_id(razao_social)')
            .order('nome');

        if (error) {
            setMessage("Erro ao buscar contas: " + error.message);
        } else {
            setContas(data || []);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchContas();
    }, [fetchContas]);
    
    const handleSaveConta = async (formData) => {
        const isEditing = Boolean(formData.id);
        
        const saldoNumerico = parseFloat(String(formData.saldo_inicial).replace(/[^0-9,.]/g, '').replace('.', '').replace(',', '.')) || 0;
        
        const dataToSave = {
            ...formData,
            saldo_inicial: saldoNumerico
        };

        let error;
        if (isEditing) {
            const { id, ...updateData } = dataToSave;
            const { error: updateError } = await supabase.from('contas_financeiras').update(updateData).eq('id', id);
            error = updateError;
        } else {
            delete dataToSave.id;
            const { error: insertError } = await supabase.from('contas_financeiras').insert(dataToSave);
            error = insertError;
        }

        if (error) {
            setMessage(`Erro: ${error.message}`);
            return false;
        }

        setMessage(`Conta ${isEditing ? 'atualizada' : 'criada'} com sucesso!`);
        setTimeout(() => setMessage(''), 3000);
        fetchContas();
        return true;
    };

    const handleDeleteConta = async (contaId) => {
        if (!window.confirm("Tem certeza que deseja excluir esta conta? Todas as transações associadas também serão perdidas.")) return;
        
        const { error } = await supabase.from('contas_financeiras').delete().eq('id', contaId);

        if (error) {
            setMessage(`Erro ao excluir: ${error.message}`);
        } else {
            setMessage("Conta excluída com sucesso.");
            fetchContas();
        }
    };
    
    const handleOpenEditModal = (conta) => {
        setEditingConta(conta);
        setIsModalOpen(true);
    };

    const handleOpenAddModal = () => {
        setEditingConta(null);
        setIsModalOpen(true);
    };
    
    const getAccountIcon = (type) => {
        switch (type) {
            case 'Conta Corrente': return faUniversity;
            case 'Cartão de Crédito': return faCreditCard;
            case 'Dinheiro': return faMoneyBillWave;
            case 'Investimento': return faChartLine;
            default: return faUniversity;
        }
    };
    
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <ContaFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveConta}
                initialData={editingConta}
            />
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Minhas Contas</h2>
                <button 
                    onClick={handleOpenAddModal}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Nova Conta
                </button>
            </div>

            {message && <p className="text-center text-sm font-medium p-2 bg-blue-50 text-blue-800 rounded-md">{message}</p>}

            {loading ? (
                 <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
            ) : contas.length === 0 ? (
                <p className="text-center text-gray-500 py-10">Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {contas.map(conta => (
                        <div key={conta.id} className="border p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow relative group">
                            <div className="flex items-center gap-4 mb-3">
                                <FontAwesomeIcon icon={getAccountIcon(conta.tipo)} className="text-2xl text-blue-500" />
                                <div>
                                    <h3 className="font-bold text-lg">{conta.nome}</h3>
                                    <p className="text-xs text-gray-500">{conta.instituicao}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-600">Saldo Inicial</p>
                                <p className="text-xl font-semibold text-gray-800">{formatCurrency(conta.saldo_inicial)}</p>
                            </div>
                             <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenEditModal(conta)} className="text-gray-500 hover:text-blue-600"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                <button onClick={() => handleDeleteConta(conta.id)} className="text-gray-500 hover:text-red-600"><FontAwesomeIcon icon={faTrash} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}