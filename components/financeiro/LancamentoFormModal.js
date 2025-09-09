"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faReceipt, faCalendarAlt, faRetweet, faExchangeAlt, faArrowUp, faArrowDown, faTimes, faPlus, faPaperclip, faUpload, faFileLines, faEye, faTrashAlt, faRobot } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

// Componentes internos (sem alterações)
const TipoToggleButton = ({ label, icon, isActive, onClick, colorClass = 'bg-blue-500 hover:bg-blue-600' }) => {
    const baseClasses = "flex-1 p-2 rounded-md font-semibold text-xs flex items-center justify-center gap-2 transition-colors";
    const activeClasses = `shadow text-white ${colorClass}`;
    const inactiveClasses = "bg-gray-200 text-gray-600 hover:bg-gray-300";
    return (
        <button type="button" onClick={onClick} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
            <FontAwesomeIcon icon={icon} />
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
};
const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>
            )}
        </span>
    );
};

export default function LancamentoFormModal({ isOpen, onClose, onSuccess, initialData }) {
    const supabase = createClient();
    const { user } = useAuth();
    const isEditing = Boolean(initialData?.id);
    
    const getInitialState = () => ({
        descricao: '', valor: '', data_transacao: new Date().toISOString().split('T')[0],
        tipo: 'Despesa', form_type: 'simples', status: 'Pendente', conta_id: null, categoria_id: null,
        empreendimento_id: null, etapa_id: null, favorecido_contato_id: null,
        empresa_id: null, observacoes: '',
        numero_parcelas: 2, data_primeiro_vencimento: new Date().toISOString().split('T')[0],
        frequencia: 'Mensal', recorrencia_data_inicio: new Date().toISOString().split('T')[0], recorrencia_data_fim: null,
        novo_favorecido: null,
        anexo_preexistente: null, 
        anexo: { file: null, descricao: '', tipo_documento_id: null },
        data_pagamento: null,
        conta_origem_id: null,
        conta_destino_id: null,
    });

    const [formData, setFormData] = useState(getInitialState());
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    
    const [contas, setContas] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [etapas, setEtapas] = useState([]);
    const [tiposDocumento, setTiposDocumento] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    
    const [favorecidoSearchTerm, setFavorecidoSearchTerm] = useState('');
    const [favorecidoSearchResults, setFavorecidoSearchResults] = useState([]);
    const [isSearchingFavorecido, setIsSearchingFavorecido] = useState(false);
    const [searchAttempted, setSearchAttempted] = useState(false);
    
    const [isDragging, setIsDragging] = useState(false);
    
    useEffect(() => {
        const fetchDropdownData = async () => {
            setLoading(true);
            const [
                { data: contasData }, { data: categoriasData }, { data: empreendimentosData },
                { data: etapasData }, { data: tiposDocData }, { data: empresasData }
            ] = await Promise.all([
                supabase.from('contas_financeiras').select('id, nome, empresa_id').order('nome'),
                supabase.from('categorias_financeiras').select('id, nome, tipo').order('nome'),
                supabase.from('empreendimentos').select('id, nome, empresa_id:empresa_proprietaria_id').order('nome'),
                supabase.from('etapa_obra').select('id, nome_etapa').order('nome_etapa'),
                supabase.from('documento_tipos').select('*').order('sigla'),
                supabase.from('empresas').select('id, nome_fantasia, razao_social').order('nome_fantasia')
            ]);
            setContas(contasData || []);
            setCategorias(categoriasData || []);
            setEmpreendimentos(empreendimentosData || []);
            setEtapas(etapasData || []);
            setTiposDocumento(tiposDocData || []);
            setEmpresas(empresasData || []);
            setLoading(false);
        };

        if (isOpen) {
            fetchDropdownData();
            setMessage('');
            if (initialData) {
                const anexoData = initialData.anexos && initialData.anexos[0] ? initialData.anexos[0] : null;
                const dataToLoad = { 
                    ...initialData, observacoes: initialData.observacao || '', valor: initialData.valor || '',
                    data_transacao: initialData.data_transacao ? new Date(initialData.data_transacao).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    data_vencimento: initialData.data_vencimento ? new Date(initialData.data_vencimento).toISOString().split('T')[0] : null,
                    data_pagamento: initialData.data_pagamento ? new Date(initialData.data_pagamento).toISOString().split('T')[0] : null,
                };
                setFormData({ ...getInitialState(), ...dataToLoad, anexo: { file: null, ...anexoData } });
                if(initialData.favorecido) { setFavorecidoSearchTerm(initialData.favorecido.nome || initialData.favorecido.razao_social); }
            } else { setFormData(getInitialState()); }
            if(!initialData || !initialData.favorecido) { setFavorecidoSearchTerm(''); }
            setFavorecidoSearchResults([]);
            setSearchAttempted(false);
        }
    }, [isOpen, initialData, supabase]);

    // A LÓGICA FINAL E À PROVA DE BALAS
    const handleChange = (e) => {
        const { name, value } = e.target;
        
        let newFormData = { ...formData, [name]: value === '' ? null : value };

        if (name === 'form_type' && value === 'transferencia') newFormData.tipo = 'Despesa';
        if (name === 'status' && value === 'Pago' && !newFormData.data_pagamento) {
            newFormData.data_pagamento = new Date().toISOString().split('T')[0];
        }

        // Se o usuário muda a EMPRESA manualmente, reseta os filhos
        if (name === 'empresa_id') {
            newFormData.conta_id = null;
            newFormData.empreendimento_id = null;
            newFormData.etapa_id = null;
        }

        // Se o usuário muda a CONTA, define a empresa e valida o empreendimento
        if (name === 'conta_id') {
            const conta = contas.find(c => c.id == value);
            if (conta?.empresa_id) {
                const novaEmpresaId = String(conta.empresa_id);
                newFormData.empresa_id = novaEmpresaId;
                
                const emp = empreendimentos.find(em => em.id == newFormData.empreendimento_id);
                if (emp && String(emp.empresa_id) !== novaEmpresaId) {
                    newFormData.empreendimento_id = null;
                    newFormData.etapa_id = null;
                }
            }
        }
        
        // Se o usuário muda o EMPREENDIMENTO, define a empresa e valida a conta
        if (name === 'empreendimento_id') {
            newFormData.etapa_id = null; // Sempre reseta a etapa
            const emp = empreendimentos.find(em => em.id == value);
            if (emp?.empresa_id) {
                const novaEmpresaId = String(emp.empresa_id);
                newFormData.empresa_id = novaEmpresaId;

                const conta = contas.find(c => c.id == newFormData.conta_id);
                if (conta && String(conta.empresa_id) !== novaEmpresaId) {
                    newFormData.conta_id = null;
                }
            }
        }

        setFormData(newFormData);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('Salvando, por favor aguarde...');
        try {
            if (!user) throw new Error("Usuário não autenticado.");
            const valorNumerico = parseFloat(String(formData.valor || '0')) || 0;
            let favorecidoFinalId = formData.favorecido_contato_id;
            if (formData.novo_favorecido && formData.novo_favorecido.nome) {
                const { data: novoContato, error: contatoError } = await supabase.from('contatos').insert({ nome: formData.novo_favorecido.nome, tipo_contato: 'Fornecedor' }).select().single();
                if (contatoError) throw contatoError;
                favorecidoFinalId = novoContato.id;
            }
            const baseData = {
                descricao: formData.descricao, status: formData.status, categoria_id: formData.categoria_id,
                empreendimento_id: formData.empreendimento_id, etapa_id: formData.etapa_id, empresa_id: formData.empresa_id,
                observacao: formData.observacoes, favorecido_contato_id: favorecidoFinalId, criado_por_usuario_id: user.id,
                id_transacao_externa: formData.id_transacao_externa,
            };
            let error = null;
            let createdRecord = null;
            if (isEditing) {
                const { data: updatedData, error: updateError } = await supabase.from('lancamentos').update({ ...baseData, tipo: formData.tipo, conta_id: formData.conta_id, valor: valorNumerico, data_vencimento: formData.data_vencimento, data_pagamento: formData.data_pagamento }).eq('id', formData.id).select().single();
                error = updateError;
                createdRecord = updatedData;
            } else {
                if (formData.form_type === 'transferencia') {
                    const transferencia_id = crypto.randomUUID();
                    const contaOrigemNome = contas.find(c => c.id == formData.conta_origem_id)?.nome || 'N/A';
                    const contaDestinoNome = contas.find(c => c.id == formData.conta_destino_id)?.nome || 'N/A';
                    const lancamentosTransferencia = [
                        { ...baseData, valor: valorNumerico, data_transacao: formData.data_transacao, data_vencimento: formData.data_vencimento, data_pagamento: formData.data_pagamento, status: 'Pago', tipo: 'Despesa', conta_id: formData.conta_origem_id, transferencia_id, descricao: `Transferência para: ${contaDestinoNome}` },
                        { ...baseData, valor: valorNumerico, data_transacao: formData.data_transacao, data_vencimento: formData.data_vencimento, data_pagamento: formData.data_pagamento, status: 'Pago', tipo: 'Receita', conta_id: formData.conta_destino_id, transferencia_id, descricao: `Transferência de: ${contaOrigemNome}` }
                    ];
                    const { error: insertError } = await supabase.from('lancamentos').insert(lancamentosTransferencia);
                    error = insertError;
                } else if (formData.form_type === 'parcelado') {
                    const valorParcela = valorNumerico / formData.numero_parcelas;
                    const lancamentosParcelados = [];
                    for (let i = 0; i < formData.numero_parcelas; i++) {
                        const dataVencimento = new Date(formData.data_primeiro_vencimento);
                        dataVencimento.setUTCMonth(dataVencimento.getUTCMonth() + i);
                        lancamentosParcelados.push({ ...baseData, tipo: formData.tipo, conta_id: formData.conta_id, descricao: `${formData.descricao} [${i + 1}/${formData.numero_parcelas}]`, valor: valorParcela, data_transacao: formData.data_primeiro_vencimento, data_vencimento: dataVencimento.toISOString().split('T')[0] });
                    }
                    const { error: insertError } = await supabase.from('lancamentos').insert(lancamentosParcelados);
                    error = insertError;
                } else if (formData.form_type === 'recorrente') {
                    const lancamentosRecorrentes = [];
                    let dataCorrente = new Date(formData.recorrencia_data_inicio);
                    const dataFim = formData.recorrencia_fim ? new Date(formData.recorrencia_fim) : new Date(new Date().setFullYear(new Date().getFullYear() + 2));
                    while (dataCorrente <= dataFim) {
                        lancamentosRecorrentes.push({ ...baseData, tipo: formData.tipo, conta_id: formData.conta_id, descricao: `${formData.descricao} [${dataCorrente.toLocaleDateString('pt-BR', {month: '2-digit', year:'numeric'})}]`, valor: valorNumerico, data_transacao: formData.recorrencia_data_inicio, data_vencimento: dataCorrente.toISOString().split('T')[0] });
                        if(formData.frequencia === 'Mensal') dataCorrente.setMonth(dataCorrente.getMonth() + 1);
                        else if (formData.frequencia === 'Anual') dataCorrente.setFullYear(dataCorrente.getFullYear() + 1);
                    }
                    const { error: insertError } = await supabase.from('lancamentos').insert(lancamentosRecorrentes);
                    error = insertError;
                } else {
                    const { data: newLancamento, error: insertError } = await supabase.from('lancamentos').insert({ ...baseData, tipo: formData.tipo, conta_id: formData.conta_id, valor: valorNumerico, data_transacao: formData.data_transacao, data_vencimento: formData.data_vencimento, data_pagamento: formData.data_pagamento }).select().single();
                    error = insertError;
                    if (!insertError && newLancamento) { createdRecord = newLancamento; }
                }
            }
            if (error) throw error;
            setMessage(`Lançamento(s) salvo(s) com sucesso!`);
            if (onSuccess) { onSuccess(createdRecord); }
            setTimeout(onClose, 1500);
        } catch (error) {
            const detailedError = `ERRO: ${error.message}. Detalhes: ${error.details || 'N/A'}. Código: ${error.code || 'N/A'}`;
            setMessage(detailedError);
            console.error("FALHA AO SALVAR:", error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleFavorecidoSearch = async (e) => { const value = e.target.value; setSearchAttempted(true); setFavorecidoSearchTerm(value); if (value.length < 2) { setFavorecidoSearchResults([]); return; } setIsSearchingFavorecido(true); const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: value }); setFavorecidoSearchResults(data || []); setIsSearchingFavorecido(false); };
    const handleSelectFavorecido = (contato) => { setFormData(prev => ({ ...prev, favorecido_contato_id: contato.id, novo_favorecido: null })); setFavorecidoSearchTerm(contato.nome || contato.razao_social); setFavorecidoSearchResults([]); };
    const handleClearFavorecido = () => { setFormData(prev => ({ ...prev, favorecido_contato_id: null, novo_favorecido: null })); setFavorecidoSearchTerm(''); };
    const handleAddNewFavorecido = () => { setFormData(prev => ({ ...prev, favorecido_contato_id: null, novo_favorecido: { nome: favorecidoSearchTerm } })); setFavorecidoSearchTerm(favorecidoSearchTerm); setFavorecidoSearchResults([]); };
    const handleAnexoChange = (files) => { if (files && files[0]) { setFormData(prev => ({ ...prev, anexo: { ...prev.anexo, file: files[0] } })); } };
    const handleDragEvents = (e) => { e.preventDefault(); e.stopPropagation(); if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true); else if (e.type === "dragleave") setIsDragging(false); };
    const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { handleAnexoChange(e.dataTransfer.files); e.dataTransfer.clearData(); } };
    const handleViewAnexo = async () => { if (!formData.anexo?.caminho_arquivo) return; const { data } = await supabase.storage.from('documentos-financeiro').createSignedUrl(formData.anexo.caminho_arquivo, 3600); if (data?.signedUrl) window.open(data.signedUrl, '_blank'); };
    const handleRemoveAnexo = async () => { if (isEditing && formData.anexo?.id && window.confirm("Isso excluirá o anexo permanentemente. Deseja continuar?")) { await supabase.from('lancamentos_anexos').delete().eq('id', formData.anexo.id); await supabase.storage.from('documentos-financeiro').remove([formData.anexo.caminho_arquivo]); } setFormData(prev => ({ ...prev, anexo: { file: null, descricao: '', tipo_documento_id: null }, anexo_preexistente: null })); };

    if (!isOpen) return null;

    const filteredCategorias = categorias.filter(c => c.tipo === formData.tipo);
    const filteredContas = formData.empresa_id 
        ? contas.filter(c => String(c.empresa_id) === String(formData.empresa_id)) 
        : contas;
    const filteredEmpreendimentos = formData.empresa_id
        ? empreendimentos.filter(e => String(e.empresa_id) === String(formData.empresa_id))
        : empreendimentos;

    const anexoVisivel = formData.anexo?.id || formData.anexo?.file || formData.anexo_preexistente;
    const nomeAnexoVisivel = formData.anexo?.file?.name || formData.anexo?.nome_arquivo || formData.anexo_preexistente?.nome_arquivo;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[95vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4 text-center">{isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
                {message && <p className={`text-center p-3 rounded-md text-sm font-semibold mb-4 ${message.includes('ERRO') ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-800'}`}>{message}</p>}
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-6 p-2 bg-gray-100 rounded-lg">
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-semibold text-center text-gray-600 block">Natureza</label>
                            <div className="flex gap-2">
                                <TipoToggleButton label="Despesa" icon={faArrowDown} isActive={formData.tipo === 'Despesa' && formData.form_type !== 'transferencia'} onClick={() => { if(isEditing) return; handleChange({ target: { name: 'tipo', value: 'Despesa' }})}} colorClass="bg-red-500 hover:bg-red-600" />
                                <TipoToggleButton label="Receita" icon={faArrowUp} isActive={formData.tipo === 'Receita' && formData.form_type !== 'transferencia'} onClick={() => { if(isEditing) return; handleChange({ target: { name: 'tipo', value: 'Receita' }})}} colorClass="bg-green-500 hover:bg-green-600" />
                            </div>
                        </div>
                        {!isEditing && (
                            <div className="flex-1 space-y-2">
                                <label className="text-sm font-semibold text-center text-gray-600 block">Estrutura</label>
                                <div className="flex gap-2">
                                    <TipoToggleButton label="Simples" icon={faReceipt} isActive={formData.form_type === 'simples'} onClick={() => handleChange({ target: { name: 'form_type', value: 'simples' }})} />
                                    <TipoToggleButton label="Parcelado" icon={faCalendarAlt} isActive={formData.form_type === 'parcelado'} onClick={() => handleChange({ target: { name: 'form_type', value: 'parcelado' }})} />
                                    <TipoToggleButton label="Recorrente" icon={faRetweet} isActive={formData.form_type === 'recorrente'} onClick={() => handleChange({ target: { name: 'form_type', value: 'recorrente' }})} />
                                    <TipoToggleButton label="Transferência" icon={faExchangeAlt} isActive={formData.form_type === 'transferencia'} onClick={() => handleChange({ target: { name: 'form_type', value: 'transferencia' }})} colorClass="bg-yellow-500 hover:bg-yellow-600 text-gray-800" />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="space-y-4 pt-4 border-t">
                        <input type="text" name="descricao" value={formData.descricao || ''} onChange={handleChange} required placeholder="Descrição do Lançamento *" className="w-full p-2 border rounded-md" />
                        
                        {formData.form_type === 'parcelado' && !isEditing && (
                            <fieldset className="p-3 border rounded-lg bg-gray-50 animate-fade-in">
                                <legend className="font-semibold text-sm">Detalhes do Parcelamento</legend>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                    <div>
                                        <label className="block text-sm font-medium">Valor Total *</label>
                                        <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] }}} unmask={true} name="valor" value={String(formData.valor || '')} onAccept={(v) => handleChange({target: {name: 'valor', value: v}})} required className="w-full p-2 border rounded-md"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Nº de Parcelas *</label>
                                        <input type="number" min="2" name="numero_parcelas" value={formData.numero_parcelas} onChange={handleChange} required className="w-full p-2 border rounded-md"/>
                                    </div>
                                     <div>
                                        <label className="block text-sm font-medium">1º Vencimento *</label>
                                        <input type="date" name="data_primeiro_vencimento" value={formData.data_primeiro_vencimento} onChange={handleChange} required className="w-full p-2 border rounded-md"/>
                                    </div>
                                </div>
                            </fieldset>
                        )}

                        {formData.form_type === 'recorrente' && !isEditing && (
                            <fieldset className="p-3 border rounded-lg bg-gray-50 animate-fade-in">
                                <legend className="font-semibold text-sm">Detalhes da Recorrência</legend>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                    <div>
                                        <label className="block text-sm font-medium">Valor Mensal *</label>
                                        <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] }}} unmask={true} name="valor" value={String(formData.valor || '')} onAccept={(v) => handleChange({target: {name: 'valor', value: v}})} required className="w-full p-2 border rounded-md"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Data Início *</label>
                                        <input type="date" name="recorrencia_data_inicio" value={formData.recorrencia_data_inicio} onChange={handleChange} required className="w-full p-2 border rounded-md"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium">Data Fim (Opcional)</label>
                                        <input type="date" name="recorrencia_data_fim" value={formData.recorrencia_data_fim || ''} onChange={handleChange} className="w-full p-2 border rounded-md"/>
                                    </div>
                                </div>
                            </fieldset>
                        )}
                        
                        {(formData.form_type === 'simples' || formData.form_type === 'transferencia' || isEditing) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">Valor *</label>
                                    <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] }}} unmask={true} name="valor" value={String(formData.valor || '')} onAccept={(unmaskedValue) => handleChange({target: {name: 'valor', value: unmaskedValue}})} required className="w-full p-2 border rounded-md"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">{formData.form_type === 'transferencia' ? 'Data da Transferência *' : 'Data de Vencimento *'}</label>
                                    <input type="date" name="data_vencimento" value={formData.data_vencimento || ''} onChange={handleChange} required className="w-full p-2 border rounded-md"/>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Empresa</label>
                                <select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                    <option value="">Selecione a Empresa</option>
                                    {empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>)}
                                </select>
                            </div>
                            
                            {formData.form_type === 'transferencia' ? (
                                <>
                                <div><label className="block text-sm font-medium">De (Origem)*</label><select name="conta_origem_id" value={formData.conta_origem_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{filteredContas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                                <div><label className="block text-sm font-medium">Para (Destino)*</label><select name="conta_destino_id" value={formData.conta_destino_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{contas.filter(c => c.id !== formData.conta_origem_id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                                </>
                            ) : (
                                <div><label className="block text-sm font-medium">Conta*</label><select name="conta_id" value={formData.conta_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione a Conta</option>{filteredContas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                            )}

                            <div><label className="block text-sm font-medium">Empreendimento</label><select name="empreendimento_id" value={formData.empreendimento_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Nenhum</option>{filteredEmpreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></div>
                            <div><label className="block text-sm font-medium">Etapa da Obra</label><select name="etapa_id" value={formData.etapa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" disabled={!formData.empreendimento_id}><option value="">Nenhuma</option>{etapas.map(e => <option key={e.id} value={e.id}>{e.nome_etapa}</option>)}</select></div>
                            <div><label className="block text-sm font-medium">Categoria</label><select name="categoria_id" value={formData.categoria_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{filteredCategorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                            
                            <div className="md:col-span-2 relative">
                                <label className="block text-sm font-medium">Favorecido / Fornecedor</label>
                                <input type="text" value={favorecidoSearchTerm} onChange={handleFavorecidoSearch} disabled={!!formData.favorecido_contato_id} placeholder={formData.favorecido_contato_id ? '' : 'Digite para buscar...'} className="mt-1 w-full p-2 border rounded-md" />
                                {formData.favorecido_contato_id && ( <button type="button" onClick={handleClearFavorecido} className="absolute right-2 top-8 text-gray-500 hover:text-red-600"><FontAwesomeIcon icon={faTimes} /></button> )}
                                {favorecidoSearchTerm && !formData.favorecido_contato_id && (
                                    <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                                        {isSearchingFavorecido && <li className="px-4 py-2 text-gray-500">Buscando...</li>}
                                        {!isSearchingFavorecido && searchAttempted && favorecidoSearchResults.length === 0 && ( <li className="px-4 py-2 text-center text-gray-500">Nenhum resultado. <button type="button" onClick={handleAddNewFavorecido} className="text-blue-600 hover:underline font-semibold ml-2">Adicionar Novo?</button></li> )}
                                        {favorecidoSearchResults.map(contato => ( <li key={contato.id} onClick={() => handleSelectFavorecido(contato)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={contato.nome || contato.razao_social} highlight={favorecidoSearchTerm} /></li> ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <label className="block text-sm font-medium mb-2">Anexo</label>
                             {anexoVisivel ? (
                                <div className="p-3 border rounded-md bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-sm">
                                        <FontAwesomeIcon icon={faFileLines} className="text-gray-600" />
                                        <span>{nomeAnexoVisivel}</span>
                                        {formData.anexo_preexistente && <span className="text-xs font-bold text-green-700">(Anexado do Pedido)</span>}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {(formData.anexo.id || formData.anexo_preexistente) && <button type="button" onClick={handleViewAnexo} className="text-blue-600 hover:text-blue-800"><FontAwesomeIcon icon={faEye} title="Visualizar Anexo" /></button>}
                                        <button type="button" onClick={handleRemoveAnexo} className="text-red-600 hover:text-red-800"><FontAwesomeIcon icon={faTrashAlt} title="Remover Anexo" /></button>
                                    </div>
                                </div>
                            ) : (
                                <div onDragEnter={handleDragEvents} onDragLeave={handleDragEvents} onDragOver={handleDragEvents} onDrop={handleDrop} className={`p-6 border-2 border-dashed rounded-md text-center cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}>
                                    <input type="file" id="anexo-upload" className="hidden" onChange={(e) => handleAnexoChange(e.target.files)} />
                                    <label htmlFor="anexo-upload" className="cursor-pointer">
                                        <FontAwesomeIcon icon={faUpload} className="text-gray-500 text-2xl mb-2" />
                                        <p className="text-sm text-gray-600">Arraste e solte um arquivo aqui, ou <span className="font-semibold text-blue-600">clique para selecionar</span>.</p>
                                    </label>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <input type="text" name="anexo.descricao" value={formData.anexo.descricao || ''} onChange={(e) => setFormData(prev => ({...prev, anexo: {...prev.anexo, descricao: e.target.value}}))} placeholder="Descrição do anexo" className="w-full p-2 border rounded-md" />
                                <select name="anexo.tipo_documento_id" value={formData.anexo.tipo_documento_id || ''} onChange={(e) => setFormData(prev => ({...prev, anexo: {...prev.anexo, tipo_documento_id: e.target.value || null}}))} className="w-full p-2 border rounded-md">
                                    <option value="">Tipo de Documento...</option>
                                    {tiposDocumento.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.sigla} - {tipo.descricao}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : (isEditing ? 'Salvar Alterações' : 'Criar Lançamento')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}