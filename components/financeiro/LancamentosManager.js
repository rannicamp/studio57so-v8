"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faPenToSquare, faTrash, faArrowUp, faArrowDown, faPaperclip } from '@fortawesome/free-solid-svg-icons';
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
        const { data, error } = await supabase
            .from('lancamentos')
            .select(`
                *,
                conta:contas_financeiras(nome),
                categoria:categorias_financeiras(nome),
                favorecido:favorecido_contato_id(nome, razao_social),
                anexos:lancamentos_anexos(*)
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
        const { novo_favorecido, anexo, ...baseFormData } = formData;

        let finalFormData = { ...baseFormData };

        if (novo_favorecido && novo_favorecido.nome) {
            const { data: novoContato, error: contatoError } = await supabase
                .from('contatos')
                .insert({
                    nome: novo_favorecido.nome,
                    tipo_contato: novo_favorecido.tipo_contato,
                    personalidade_juridica: 'Pessoa Física'
                })
                .select()
                .single();
            if (contatoError) { setMessage(`Erro ao criar novo contato: ${contatoError.message}`); return false; }
            finalFormData.favorecido_contato_id = novoContato.id;
        }
        
        const saveAnexo = async (lancamentoId) => {
            if (!anexo || !anexo.file) return;

            const file = anexo.file;
            const safeFileNameBase = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9.]/g, '_');
            const fileExtension = safeFileNameBase.includes('.') ? safeFileNameBase.split('.').pop() : '';
            const fileNameWithoutExt = fileExtension ? safeFileNameBase.slice(0, - (fileExtension.length + 1)) : safeFileNameBase;
            const finalSafeName = fileNameWithoutExt.replace(/__+/g, '_') + (fileExtension ? '.' + fileExtension : '');
            const fileName = `${Date.now()}-${finalSafeName}`;
            const filePath = `lancamentos/${lancamentoId}/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('documentos-financeiro').upload(filePath, file);
            if (uploadError) throw new Error(`Erro no upload do anexo: ${uploadError.message}`);

            // Deleta anexo antigo se existir, antes de inserir o novo
            if (isEditing) {
                await supabase.from('lancamentos_anexos').delete().eq('lancamento_id', lancamentoId);
            }

            const { error: dbError } = await supabase.from('lancamentos_anexos').insert({
                lancamento_id: lancamentoId,
                caminho_arquivo: filePath,
                nome_arquivo: file.name,
                descricao: anexo.descricao,
                tipo_documento_id: anexo.tipo_documento_id
            });
            if (dbError) throw new Error(`Erro ao salvar referência do anexo: ${dbError.message}`);
        };

        try {
            if (finalFormData.form_type === 'parcelado') {
                const numeroParcelas = parseInt(finalFormData.numero_parcelas, 10);
                const valorParcela = finalFormData.valor / numeroParcelas;
                const vencimentoInicial = new Date(finalFormData.data_primeiro_vencimento + 'T12:00:00Z');
                let lancamentosParaCriar = [];

                for (let i = 0; i < numeroParcelas; i++) {
                    const dataVencimento = new Date(vencimentoInicial);
                    dataVencimento.setUTCMonth(dataVencimento.getUTCMonth() + i);
                    lancamentosParaCriar.push({
                        descricao: finalFormData.descricao, valor: valorParcela, data_transacao: finalFormData.data_transacao,
                        data_vencimento: dataVencimento.toISOString().split('T')[0], tipo: finalFormData.tipo,
                        status: 'Pendente', conta_id: finalFormData.conta_id, categoria_id: finalFormData.categoria_id,
                        empreendimento_id: finalFormData.empreendimento_id, etapa_id: finalFormData.etapa_id,
                        favorecido_contato_id: finalFormData.favorecido_contato_id, parcela_info: `${i + 1}/${numeroParcelas}`
                    });
                }
                const { data: createdLancamentos, error } = await supabase.from('lancamentos').insert(lancamentosParaCriar).select();
                if (error) throw error;
                
                if (anexo?.file && createdLancamentos) {
                    for (const lanc of createdLancamentos) {
                        await saveAnexo(lanc.id);
                    }
                }
                setMessage(`${numeroParcelas} parcelas criadas com sucesso!`);

            } else { 
                let savedLancamento;

                if (finalFormData.tipo === 'Transferência') {
                    const { error } = await supabase.rpc('realizar_transferencia', {
                        p_descricao: finalFormData.descricao, p_valor: finalFormData.valor, p_data_transacao: finalFormData.data_transacao,
                        p_conta_origem_id: finalFormData.conta_id, p_conta_destino_id: finalFormData.conta_destino_id,
                    });
                    if (error) throw error;
                    setMessage('Transferência realizada com sucesso!');
                
                } else { 
                    const dataToSave = { ...finalFormData };
                    ['conta', 'categoria', 'favorecido', 'conta_destino_id', 'form_type', 'is_parcelado', 'numero_parcelas', 'data_primeiro_vencimento', 'is_recorrente', 'frequencia', 'recorrencia_data_inicio', 'recorrencia_data_fim', 'anexos'].forEach(k => delete dataToSave[k]);
                    
                    let error;
                    if (isEditing) {
                        const { id, ...updateData } = dataToSave;
                        const { data, error: updateError } = await supabase.from('lancamentos').update(updateData).eq('id', id).select().single();
                        savedLancamento = data;
                        error = updateError;
                    } else {
                        delete dataToSave.id;
                        const { data, error: insertError } = await supabase.from('lancamentos').insert(dataToSave).select().single();
                        savedLancamento = data;
                        error = insertError;
                    }
                    if (error) throw error;
                    await saveAnexo(savedLancamento.id);
                    setMessage(`Lançamento ${isEditing ? 'atualizado' : 'criado'} com sucesso!`);
                }
            }
        } catch (error) {
            setMessage(`Erro: ${error.message}`);
            return false;
        }

        setTimeout(() => setMessage(''), 4000);
        fetchLancamentos();
        return true;
    }

    const handleDeleteLancamento = async (id) => {
        if (!window.confirm("Tem certeza?")) return;
        await supabase.from('lancamentos').delete().eq('id', id);
        setMessage('Lançamento excluído.');
        fetchLancamentos();
    }

    const handleOpenAddModal = () => {
        setEditingLancamento(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (lancamento) => {
        if (lancamento.categoria === null && lancamento.descricao.toLowerCase().includes('transferência')) {
            alert("Não é possível editar uma transferência.");
            return;
        }
        if(lancamento.parcela_info) {
            alert("Não é possível editar uma parcela individualmente.");
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
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Anexo</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Vencimento</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Descrição</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Favorecido</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Categoria</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Conta</th>
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase">Valor</th>
                                <th className="px-4 py-3 text-center text-xs font-bold uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {lancamentos.length === 0 ? (
                                <tr><td colSpan="8" className="text-center py-10 text-gray-500">Nenhum lançamento encontrado.</td></tr>
                            ) : lancamentos.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 text-center">
                                        {item.anexos && item.anexos.length > 0 && (
                                            <FontAwesomeIcon icon={faPaperclip} className="text-gray-500" title="Este lançamento possui anexo" />
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-sm font-semibold">{formatDate(item.data_vencimento || item.data_transacao)}</td>
                                    <td className="px-4 py-4 text-sm font-medium">{item.descricao} {item.parcela_info && <span className="text-xs font-normal text-gray-500">({item.parcela_info})</span>}</td>
                                    <td className="px-4 py-4 text-sm">{item.favorecido?.nome || item.favorecido?.razao_social || 'N/A'}</td>
                                    <td className="px-4 py-4 text-sm">{item.categoria?.nome || 'N/A'}</td>
                                    <td className="px-4 py-4 text-sm">{item.conta?.nome || 'N/A'}</td>
                                    <td className={`px-4 py-4 text-right text-sm font-semibold ${item.tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}`}>
                                        <FontAwesomeIcon icon={item.tipo === 'Receita' ? faArrowUp : faArrowDown} className="mr-2" />
                                        {formatCurrency(item.valor)}
                                    </td>
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