"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faPenToSquare, faTrash, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import LancamentoFormModal from './LancamentoFormModal';

export default function LancamentosManager() {
    const supabase = createClient();
    const [lancamentos, setLancamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLancamento, setEditingLancamento] = useState(null);
    const [message, setMessage] = useState('');

    const fetchLancamentos = useCallback(async () => {
        setLoading(true);
        // ATUALIZAÇÃO AQUI: A query agora busca também o nome do empreendimento e da empresa.
        const { data, error } = await supabase
            .from('lancamentos')
            .select(`
                *,
                conta:contas_financeiras(nome),
                categoria:categorias_financeiras(nome),
                empreendimento:empreendimentos(
                    nome,
                    empresa:cadastro_empresa(razao_social)
                )
            `)
            .order('data_transacao', { ascending: false });

        if (error) {
            setMessage("Erro ao buscar lançamentos: " + error.message);
        } else {
            setLancamentos(data || []);
        }
        
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchLancamentos();
    }, [fetchLancamentos]);
    
    const handleSaveLancamento = async (formData) => {
        const isEditing = Boolean(formData.id);
        
        if (formData.form_type === 'parcelado') {
            const numeroParcelas = parseInt(formData.numero_parcelas, 10);
            const valorParcela = formData.valor / numeroParcelas;
            const vencimentoInicial = new Date(formData.data_primeiro_vencimento + 'T12:00:00Z');
            
            let lancamentosParaCriar = [];
            for (let i = 0; i < numeroParcelas; i++) {
                const dataVencimento = new Date(vencimentoInicial);
                dataVencimento.setUTCMonth(dataVencimento.getUTCMonth() + i);

                lancamentosParaCriar.push({
                    descricao: formData.descricao,
                    valor: valorParcela,
                    data_transacao: formData.data_transacao,
                    data_vencimento: dataVencimento.toISOString().split('T')[0],
                    tipo: formData.tipo,
                    status: 'Pendente',
                    conta_id: formData.conta_id,
                    categoria_id: formData.categoria_id,
                    empreendimento_id: formData.empreendimento_id,
                    etapa_id: formData.etapa_id,
                    parcela_info: `${i + 1}/${numeroParcelas}`
                });
            }
            
            const { error } = await supabase.from('lancamentos').insert(lancamentosParaCriar);
            if (error) { setMessage(`Erro ao criar parcelas: ${error.message}`); return false; }
            setMessage(`${numeroParcelas} parcelas criadas com sucesso!`);
        
        } else if (formData.form_type === 'recorrente') {
            const { error } = await supabase.from('recorrencias').insert({
                descricao: formData.descricao, valor: formData.valor, frequencia: formData.frequencia,
                data_inicio: formData.recorrencia_data_inicio, data_fim: formData.recorrencia_data_fim,
                conta_id: formData.conta_id, categoria_id: formData.categoria_id,
                empreendimento_id: formData.empreendimento_id, etapa_id: formData.etapa_id,
            });
            if (error) { setMessage(`Erro ao criar recorrência: ${error.message}`); return false; }
            setMessage('Recorrência salva! Os lançamentos serão gerados futuramente.');

        } else {
             if (formData.tipo === 'Transferência') {
                const { error } = await supabase.rpc('realizar_transferencia', {
                    p_descricao: formData.descricao, p_valor: formData.valor, p_data_transacao: formData.data_transacao,
                    p_conta_origem_id: formData.conta_id, p_conta_destino_id: formData.conta_destino_id,
                });
                if (error) { setMessage(`Erro na transferência: ${error.message}`); return false; }
                setMessage('Transferência realizada com sucesso!');
            } else {
                const dataToSave = { ...formData };
                ['conta', 'categoria', 'conta_destino_id', 'form_type', 'is_parcelado', 'numero_parcelas', 'data_primeiro_vencimento', 'is_recorrente', 'frequencia', 'recorrencia_data_inicio', 'recorrencia_data_fim'].forEach(k => delete dataToSave[k]);
                
                let error;
                if (isEditing) {
                    const { id, ...updateData } = dataToSave;
                    const { error: updateError } = await supabase.from('lancamentos').update(updateData).eq('id', id);
                    error = updateError;
                } else {
                    delete dataToSave.id;
                    const { error: insertError } = await supabase.from('lancamentos').insert(dataToSave);
                    error = insertError;
                }
                if (error) { setMessage(`Erro: ${error.message}`); return false; }
                setMessage(`Lançamento ${isEditing ? 'atualizado' : 'criado'} com sucesso!`);
            }
        }
        
        setTimeout(() => setMessage(''), 4000);
        fetchLancamentos();
        return true;
    }

    const handleDeleteLancamento = async (id) => {
        if (!window.confirm("Tem certeza que deseja excluir este lançamento?")) return;
        const { error } = await supabase.from('lancamentos').delete().eq('id', id);
        
        if (error) { setMessage(`Erro ao excluir: ${error.message}`); } 
        else { setMessage('Lançamento excluído.'); fetchLancamentos(); }
    }

    const handleOpenAddModal = () => {
        setEditingLancamento(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (lancamento) => {
        if (lancamento.categoria === null && lancamento.descricao.toLowerCase().includes('transferência')) {
            alert("Não é possível editar uma transferência. Por favor, exclua os dois lançamentos correspondentes e crie uma nova.");
            return;
        }
        if(lancamento.parcela_info) {
            alert("Não é possível editar uma parcela individualmente. Exclua a série de parcelas e crie um novo lançamento parcelado se necessário.");
            return;
        }
        setEditingLancamento(lancamento);
        setIsModalOpen(true);
    };
    
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <LancamentoFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveLancamento} initialData={editingLancamento} />

            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Lançamentos Financeiros</h2>
                <button onClick={handleOpenAddModal} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                    <FontAwesomeIcon icon={faPlus} /> Novo Lançamento
                </button>
            </div>

            {message && <p className="text-center text-sm font-medium p-2 bg-blue-50 text-blue-800 rounded-md">{message}</p>}

            {loading ? (
                <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
            ) : (
                 <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Vencimento</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Descrição</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Empresa</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Empreendimento</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Tipo</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Categoria</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Conta</th>
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase">Valor</th>
                                <th className="px-4 py-3 text-center text-xs font-bold uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {lancamentos.length === 0 ? (
                                <tr><td colSpan="9" className="text-center py-10 text-gray-500">Nenhum lançamento encontrado.</td></tr>
                            ) : lancamentos.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 text-sm font-semibold">{formatDate(item.data_vencimento || item.data_transacao)}</td>
                                    <td className="px-4 py-4 text-sm font-medium">{item.descricao} {item.parcela_info && <span className="text-xs font-normal text-gray-500">({item.parcela_info})</span>}</td>
                                    {/* NOVAS COLUNAS */}
                                    <td className="px-4 py-4 text-sm text-gray-600">{item.empreendimento?.empresa?.razao_social || 'N/A'}</td>
                                    <td className="px-4 py-4 text-sm text-gray-600">{item.empreendimento?.nome || 'N/A'}</td>
                                    <td className="px-4 py-4 text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.tipo === 'Receita' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {item.tipo}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm">{item.categoria?.nome || 'N/A'}</td>
                                    <td className="px-4 py-4 text-sm">{item.conta?.nome || 'N/A'}</td>
                                    <td className={`px-4 py-4 text-right text-sm font-semibold ${item.tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.valor)}</td>
                                    <td className="px-4 py-4 text-center">
                                        <button onClick={() => handleOpenEditModal(item)} className="text-blue-500 hover:text-blue-700 mr-3"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                        <button onClick={() => handleDeleteLancamento(item.id)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}