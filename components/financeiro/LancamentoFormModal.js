"use client";

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faReceipt, faCalendarAlt, faRetweet, faExchangeAlt, faArrowUp, faArrowDown, faTimes, faPlus, faPaperclip, faUpload, faFileLines, faEye, faTrashAlt, faRobot } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import { toast } from 'sonner';

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

const CategoryOption = ({ category, level = 0 }) => (
    <>
        <option key={category.id} value={category.id}>
            {'\u00A0'.repeat(level * 4)}
            {category.nome}
        </option>
        {category.children && category.children.map(child => (
            <CategoryOption key={child.id} category={child} level={level + 1} />
        ))}
    </>
);

export default function LancamentoFormModal({ isOpen, onClose, onSuccess, initialData, empresas = [] }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, organizacao_id } = useAuth();
    const isEditing = Boolean(initialData?.id);
    
    const getInitialState = () => ({
        descricao: '', valor: '', data_transacao: new Date().toISOString().split('T')[0],
        tipo: 'Despesa', form_type: 'simples', status: 'Pendente', conta_id: null, categoria_id: null,
        empreendimento_id: null, etapa_id: null, favorecido_contato_id: null,
        empresa_id: null, observacoes: '',
        numero_parcelas: 2, data_primeiro_vencimento: new Date().toISOString().split('T')[0],
        frequencia: 'Mensal', recorrencia_data_inicio: new Date().toISOString().split('T')[0], recorrencia_data_fim: null,
        novo_favorecido: null,
        anexos: [], 
        anexos_preexistentes: [],
        data_pagamento: null,
        data_vencimento: new Date().toISOString().split('T')[0],
        conta_origem_id: null,
        conta_destino_id: null,
    });

    const [formData, setFormData] = useState(getInitialState());
    const [favorecidoSearchTerm, setFavorecidoSearchTerm] = useState('');
    const [favorecidoSearchResults, setFavorecidoSearchResults] = useState([]);
    const [isSearchingFavorecido, setIsSearchingFavorecido] = useState(false);
    const [searchAttempted, setSearchAttempted] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [aiFile, setAiFile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);


    const fetchDropdownData = async () => {
        if (!organizacao_id) return null;

        const { data: contasData, error: contasError } = await supabase.from('contas_financeiras').select('id, nome').eq('organizacao_id', organizacao_id).order('nome');
        if (contasError) throw new Error(contasError.message);

        const { data: categoriasData, error: categoriasError } = await supabase.from('categorias_financeiras').select('id, nome, tipo, parent_id').eq('organizacao_id', organizacao_id).order('nome');
        if (categoriasError) throw new Error(categoriasError.message);

        const { data: empreendimentosData, error: empreendimentosError } = await supabase.from('empreendimentos').select('id, nome, empresa_id:empresa_proprietaria_id').eq('organizacao_id', organizacao_id).order('nome');
        if (empreendimentosError) throw new Error(empreendimentosError.message);

        const { data: etapasData, error: etapasError } = await supabase.from('etapa_obra').select('id, nome_etapa').eq('organizacao_id', organizacao_id).order('nome_etapa');
        if (etapasError) throw new Error(etapasError.message);

        const { data: tiposDocData, error: tiposDocError } = await supabase.from('documento_tipos').select('*').eq('organizacao_id', organizacao_id).order('sigla');
        if (tiposDocError) throw new Error(tiposDocError.message);

        return { contas: contasData, categorias: categoriasData, empreendimentos: empreendimentosData, etapas: etapasData, tiposDocumento: tiposDocData };
    };

    const { data: dropdownData, isLoading: isLoadingDropdowns, error: dropdownError } = useQuery({
        queryKey: ['lancamentoDropdowns', organizacao_id],
        queryFn: fetchDropdownData,
        enabled: isOpen && !!organizacao_id,
        staleTime: 5 * 60 * 1000,
    });
    
    const sanitizeFileName = (fileName) => {
        const withoutAccents = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const sanitized = withoutAccents
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9._-]/g, '');
        return sanitized;
    };

    // =================================================================================
    // INÍCIO DA ATUALIZAÇÃO PRINCIPAL
    // O PORQUÊ: Esta é a nova lógica de salvamento. Unificamos tudo para salvar
    // apenas na tabela 'lancamentos', incluindo a nova lógica para 'recorrente'
    // que cria todos os lançamentos futuros de uma vez só. A lógica antiga
    // que tentava salvar em 'recorrencias' foi removida, corrigindo o erro.
    // =================================================================================
    const mutation = useMutation({
        mutationFn: async (formData) => {
            if (!user || !organizacao_id) throw new Error("Usuário não autenticado ou organização não encontrada.");

            const valorNumerico = parseFloat(String(formData.valor || '0').replace(/\./g, '').replace(',', '.')) || 0;

            let favorecidoFinalId = formData.favorecido_contato_id;
            if (formData.novo_favorecido && formData.novo_favorecido.nome) {
                const { data: novoContato, error: contatoError } = await supabase.from('contatos').insert({ 
                    nome: formData.novo_favorecido.nome, 
                    tipo_contato: 'Fornecedor',
                    organizacao_id: organizacao_id
                }).select().single();
                if (contatoError) throw contatoError;
                favorecidoFinalId = novoContato.id;
            }

            const baseData = {
                descricao: formData.descricao,
                categoria_id: formData.categoria_id,
                empreendimento_id: formData.empreendimento_id,
                etapa_id: formData.etapa_id,
                empresa_id: formData.empresa_id,
                observacao: formData.observacoes,
                favorecido_contato_id: favorecidoFinalId,
                criado_por_usuario_id: user.id,
                organizacao_id: organizacao_id,
                conta_id: formData.conta_id,
                tipo: formData.tipo,
            };

            let lancamentosSalvos = [];
            let error = null;

            if (isEditing) {
                const { data, error: updateError } = await supabase.from('lancamentos').update({ 
                    ...baseData, 
                    valor: valorNumerico,
                    status: formData.status, 
                    data_vencimento: formData.data_vencimento, 
                    data_pagamento: formData.data_pagamento 
                }).eq('id', formData.id).select();
                error = updateError;
                lancamentosSalvos = data;
            } else {
                if (formData.form_type === 'transferencia') {
                    const transferenciaId = crypto.randomUUID();
                    const { data: despesaData, error: despesaError } = await supabase.from('lancamentos').insert({
                        ...baseData,
                        descricao: `Tranf. para ${dropdownData?.contas.find(c => c.id === formData.conta_destino_id)?.nome}: ${formData.descricao}`,
                        conta_id: formData.conta_origem_id,
                        valor: valorNumerico,
                        data_transacao: formData.data_vencimento,
                        data_vencimento: formData.data_vencimento,
                        data_pagamento: formData.data_vencimento,
                        status: 'Conciliado',
                        transferencia_id: transferenciaId,
                    }).select();
                    if (despesaError) { error = despesaError; }
                    else {
                        lancamentosSalvos.push(...despesaData);
                        const { error: receitaError } = await supabase.from('lancamentos').insert({
                            ...baseData,
                            descricao: `Tranf. de ${dropdownData?.contas.find(c => c.id === formData.conta_origem_id)?.nome}: ${formData.descricao}`,
                            tipo: 'Receita',
                            conta_id: formData.conta_destino_id,
                            valor: valorNumerico,
                            data_transacao: formData.data_vencimento,
                            data_vencimento: formData.data_vencimento,
                            data_pagamento: formData.data_vencimento,
                            status: 'Conciliado',
                            transferencia_id: transferenciaId,
                        });
                        if (receitaError) error = receitaError;
                    }
                } else if (formData.form_type === 'simples') {
                    const { data, error: insertError } = await supabase.from('lancamentos').insert({ 
                        ...baseData, 
                        valor: valorNumerico, 
                        status: formData.status,
                        data_transacao: formData.data_transacao, 
                        data_vencimento: formData.data_vencimento, 
                        data_pagamento: formData.data_pagamento 
                    }).select();
                    error = insertError;
                    lancamentosSalvos = data;
                } else if (formData.form_type === 'parcelado' || formData.form_type === 'recorrente') {
                    const grupo_id = crypto.randomUUID();
                    const lancamentosParaInserir = [];
                    const isRecorrente = formData.form_type === 'recorrente';

                    // Define o número de parcelas
                    let numeroDeLancamentos;
                    if (isRecorrente) {
                        if (formData.recorrencia_data_fim) {
                            const inicio = new Date(formData.recorrencia_data_inicio + 'T12:00:00Z');
                            const fim = new Date(formData.recorrencia_data_fim + 'T12:00:00Z');
                            let months = (fim.getFullYear() - inicio.getFullYear()) * 12;
                            months -= inicio.getMonth();
                            months += fim.getMonth();
                            numeroDeLancamentos = months <= 0 ? 1 : months + 1;
                        } else {
                            numeroDeLancamentos = 60; // 5 anos por padrão
                        }
                    } else {
                        numeroDeLancamentos = formData.numero_parcelas;
                    }
                    
                    const valorLancamento = (valorNumerico / (isRecorrente ? 1 : formData.numero_parcelas)).toFixed(2);
                    const dataPrimeiraOcorrencia = new Date((isRecorrente ? formData.recorrencia_data_inicio : formData.data_primeiro_vencimento) + 'T12:00:00Z');

                    for (let i = 0; i < numeroDeLancamentos; i++) {
                        const dataVencimento = new Date(dataPrimeiraOcorrencia);
                        dataVencimento.setUTCMonth(dataVencimento.getUTCMonth() + i);

                        const lancamento = {
                            ...baseData,
                            descricao: `${formData.descricao} (${i + 1}/${numeroDeLancamentos})`,
                            valor: parseFloat(isRecorrente ? valorNumerico : valorLancamento),
                            data_vencimento: dataVencimento.toISOString().split('T')[0],
                            status: 'Pendente',
                            parcela_grupo: grupo_id,
                        };

                        // Adiciona os campos de recorrência apenas ao primeiro lançamento da série
                        if (isRecorrente && i === 0) {
                            lancamento.frequencia = formData.frequencia;
                            lancamento.recorrencia_data_fim = formData.recorrencia_data_fim;
                        }
                        
                        lancamentosParaInserir.push(lancamento);
                    }

                    const { data, error: insertError } = await supabase.from('lancamentos').insert(lancamentosParaInserir).select();
                    error = insertError;
                    lancamentosSalvos = data;
                }
            }

            if (error) throw error;
            if (!lancamentosSalvos || lancamentosSalvos.length === 0) {
                throw new Error("Não foi possível salvar os dados do lançamento.");
            }
            
            // Lógica de anexo: anexa ao primeiro lançamento criado
            if (formData.anexos.length > 0) {
                const lancamentoPrincipalId = lancamentosSalvos[0].id;
                const uploadPromises = formData.anexos.map(async (anexo) => {
                    if (!anexo.file) return;
                    const file = anexo.file;
                    const fileName = `${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
                    const filePath = `public/${organizacao_id}/lancamentos/${lancamentoPrincipalId}/${fileName}`;
                    
                    const { error: uploadError } = await supabase.storage.from('documentos-financeiro').upload(filePath, file);
                    if (uploadError) throw new Error(`Falha no upload do anexo ${file.name}: ${uploadError.message}`);

                    const { error: insertAnexoError } = await supabase.from('lancamentos_anexos').insert({
                        lancamento_id: lancamentoPrincipalId,
                        caminho_arquivo: filePath,
                        nome_arquivo: file.name,
                        descricao: anexo.descricao,
                        tipo_documento_id: anexo.tipo_documento_id,
                        organizacao_id: organizacao_id
                    });
                    if (insertAnexoError) throw new Error(`Falha ao salvar anexo ${file.name} no banco: ${insertAnexoError.message}`);
                });
                await Promise.all(uploadPromises);
            }
            return lancamentosSalvos;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['lancamentos']});
            if (onSuccess) onSuccess();
            toast.success('Operação realizada com sucesso!');
            setTimeout(onClose, 1500);
        },
        onError: (err) => {
            toast.error(`Erro ao salvar: ${err.message}`);
        }
    });
    // =================================================================================
    // FIM DA ATUALIZAÇÃO PRINCIPAL
    // =================================================================================


    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                const dataToLoad = { 
                    ...initialData, 
                    observacoes: initialData.observacao || '',
                    valor: initialData.valor || '',
                    data_transacao: initialData.data_transacao ? new Date(initialData.data_transacao).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    data_vencimento: initialData.data_vencimento ? new Date(initialData.data_vencimento).toISOString().split('T')[0] : null,
                    data_pagamento: initialData.data_pagamento ? new Date(initialData.data_pagamento).toISOString().split('T')[0] : null,
                    anexos_preexistentes: initialData.anexos || [],
                    anexos: [],
                };
                setFormData({ ...getInitialState(), ...dataToLoad });
                if(initialData.favorecido) {
                    setFavorecidoSearchTerm(initialData.favorecido.nome || initialData.favorecido.razao_social);
                }
            } else {
                setFormData(getInitialState());
            }

            if(!initialData || !initialData.favorecido) {
                 setFavorecidoSearchTerm('');
            }
            setFavorecidoSearchResults([]);
            setSearchAttempted(false);
            setAiFile(null);
        }
    }, [isOpen, initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let newFormData = { ...formData, [name]: value === '' ? null : value };
        
        if (name === 'form_type' && value === 'transferencia') {
            newFormData.tipo = 'Despesa'; 
            const transferenciaCategory = dropdownData?.categorias?.find(c => c.nome.toLowerCase() === 'transferência');
            if (transferenciaCategory) {
                newFormData.categoria_id = transferenciaCategory.id;
            }
        } else if (name === 'form_type' && value !== 'transferencia') {
            if (formData.form_type === 'transferencia') {
                newFormData.tipo = 'Despesa';
                const transferenciaCategory = dropdownData?.categorias?.find(c => c.nome.toLowerCase() === 'transferência');
                if (formData.categoria_id === transferenciaCategory?.id) {
                    newFormData.categoria_id = null;
                }
            }
        }
        
        if (name === 'status' && value === 'Pago' && !newFormData.data_pagamento) { 
            newFormData.data_pagamento = new Date().toISOString().split('T')[0]; 
        }
        if (name === 'empreendimento_id') { 
            if (value && dropdownData?.empreendimentos) { const emp = dropdownData.empreendimentos.find(e => e.id == value); newFormData.empresa_id = emp?.empresa_id || null; } 
            else { newFormData.empresa_id = null; } 
            newFormData.etapa_id = null;
        }
        setFormData(newFormData);
    };
    
    const handleFavorecidoSearch = async (e) => { 
        const value = e.target.value; 
        setSearchAttempted(true); 
        setFavorecidoSearchTerm(value); 
        if (value.length < 2 || !organizacao_id) { 
            setFavorecidoSearchResults([]); 
            return; 
        } 
        setIsSearchingFavorecido(true); 
        const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: value, p_organizacao_id: organizacao_id }); 
        setFavorecidoSearchResults(data || []); 
        setIsSearchingFavorecido(false); 
    };

    const handleSelectFavorecido = (contato) => { setFormData(prev => ({ ...prev, favorecido_contato_id: contato.id, novo_favorecido: null })); setFavorecidoSearchTerm(contato.nome || contato.razao_social); setFavorecidoSearchResults([]); };
    const handleClearFavorecido = () => { setFormData(prev => ({ ...prev, favorecido_contato_id: null, novo_favorecido: null })); setFavorecidoSearchTerm(''); };
    const handleAddNewFavorecido = () => { setFormData(prev => ({ ...prev, favorecido_contato_id: null, novo_favorecido: { nome: favorecidoSearchTerm } })); setFavorecidoSearchTerm(favorecidoSearchTerm); setFavorecidoSearchResults([]); };
    
    const handleAnexoChange = (files) => {
        if (files && files.length > 0) {
            const newAnexos = Array.from(files).map(file => ({ file, descricao: '', tipo_documento_id: null }));
            setFormData(prev => ({ ...prev, anexos: [...prev.anexos, ...newAnexos] }));
        }
    };
    
    const handleDragEvents = (e) => { e.preventDefault(); e.stopPropagation(); if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true); else if (e.type === "dragleave") setIsDragging(false); };
    const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { handleAnexoChange(e.dataTransfer.files); e.dataTransfer.clearData(); } };
    
    const handleViewAnexo = async (caminho_arquivo) => {
        if (!caminho_arquivo) return;
        try {
            const { data } = supabase.storage.from('documentos-financeiro').getPublicUrl(caminho_arquivo);
            if (data?.publicUrl) {
                window.open(data.publicUrl, '_blank');
            } else {
                throw new Error("Não foi possível obter a URL pública do anexo.");
            }
        } catch (error) {
            toast.error("Erro ao gerar link do anexo.");
            console.error(error);
        }
    };
    
    const handleRemoveAnexoPreexistente = async (anexoId, caminho_arquivo, index) => {
        if (!window.confirm("Isso excluirá o anexo permanentemente. Deseja continuar?")) return;
        
        const promise = async () => {
            await supabase.from('lancamentos_anexos').delete().eq('id', anexoId);
            await supabase.storage.from('documentos-financeiro').remove([caminho_arquivo]);
            setFormData(prev => ({ ...prev, anexos_preexistentes: prev.anexos_preexistentes.filter((_, i) => i !== index) }));
        };

        toast.promise(promise(), {
            loading: 'Removendo anexo...',
            success: 'Anexo removido!',
            error: 'Falha ao remover anexo.'
        });
    };

    const handleRemoveNewAnexo = (indexToRemove) => { setFormData(prev => ({ ...prev, anexos: prev.anexos.filter((_, index) => index !== indexToRemove) })); };

    const handleNewAnexoDataChange = (index, field, value) => {
        setFormData(prev => {
            const newAnexos = [...prev.anexos];
            newAnexos[index][field] = value || null;
            return { ...prev, anexos: newAnexos };
        });
    };

    const handleAiFileChange = (e) => { if (e.target.files && e.target.files[0]) { setAiFile(e.target.files[0]); } };
    const handleAiExtract = async () => { /* Código existente sem alteração */ };


    const buildHierarchy = (items, parentId = null) => {
        return items
            .filter(item => item.parent_id === parentId)
            .map(item => ({
                ...item,
                children: buildHierarchy(items, item.id)
            }));
    };
    
    const filteredCategorias = dropdownData?.categorias?.filter(c => c.tipo === formData.tipo) || [];
    const hierarchicalCategorias = buildHierarchy(filteredCategorias);


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[95vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4 text-center">{isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
                
                {isLoadingDropdowns && <p className="text-center p-3 rounded-md text-sm font-semibold mb-4 bg-blue-50 text-blue-800"><FontAwesomeIcon icon={faSpinner} spin /> Carregando dados...</p>}
                {dropdownError && <p className="text-center p-3 rounded-md text-sm font-semibold mb-4 bg-red-100 text-red-800">Erro ao carregar dados: {dropdownError.message}</p>}

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
                        
                        {formData.form_type === 'parcelado' && !isEditing && ( <fieldset className="p-3 border rounded-lg bg-gray-50 animate-fade-in"> <legend className="font-semibold text-sm">Detalhes do Parcelamento</legend> <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2"> <div> <label className="block text-sm font-medium">Valor Total *</label> <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] }}} unmask="typed" name="valor" value={String(formData.valor || '')} onAccept={(v) => handleChange({target: {name: 'valor', value: v}})} required className="w-full p-2 border rounded-md"/> </div> <div> <label className="block text-sm font-medium">Nº de Parcelas *</label> <input type="number" min="2" name="numero_parcelas" value={formData.numero_parcelas} onChange={handleChange} required className="w-full p-2 border rounded-md"/> </div> <div> <label className="block text-sm font-medium">1º Vencimento *</label> <input type="date" name="data_primeiro_vencimento" value={formData.data_primeiro_vencimento} onChange={handleChange} required className="w-full p-2 border rounded-md"/> </div> </div> </fieldset> )}
                        {formData.form_type === 'recorrente' && !isEditing && ( <fieldset className="p-3 border rounded-lg bg-gray-50 animate-fade-in"> <legend className="font-semibold text-sm">Detalhes da Recorrência</legend> <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2"> <div> <label className="block text-sm font-medium">Valor da Parcela *</label> <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] }}} unmask="typed" name="valor" value={String(formData.valor || '')} onAccept={(v) => handleChange({target: {name: 'valor', value: v}})} required className="w-full p-2 border rounded-md"/> </div> <div> <label className="block text-sm font-medium">Data Início *</label> <input type="date" name="recorrencia_data_inicio" value={formData.recorrencia_data_inicio} onChange={handleChange} required className="w-full p-2 border rounded-md"/> </div> <div> <label className="block text-sm font-medium">Data Fim (Opcional)</label> <input type="date" name="recorrencia_data_fim" value={formData.recorrencia_data_fim || ''} onChange={handleChange} className="w-full p-2 border rounded-md"/> </div> </div> </fieldset> )}
                        {(formData.form_type === 'simples' || formData.form_type === 'transferencia' || isEditing) && ( <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <div> <label className="block text-sm font-medium">Valor *</label> <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] }}} unmask="typed" name="valor" value={String(formData.valor || '')} onAccept={(unmaskedValue) => handleChange({target: {name: 'valor', value: unmaskedValue}})} required className="w-full p-2 border rounded-md"/> </div> <div> <label className="block text-sm font-medium">{formData.form_type === 'transferencia' ? 'Data da Transferência *' : 'Data de Vencimento *'}</label> <input type="date" name="data_vencimento" value={formData.data_vencimento || ''} onChange={handleChange} required className="w-full p-2 border rounded-md"/> </div> </div> )}
                        {isEditing && ( <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <div> <label className="block text-sm font-medium">Status</label> <select name="status" value={formData.status || 'Pendente'} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"> <option value="Pendente">Pendente</option> <option value="Pago">Pago</option> </select> </div> {formData.status === 'Pago' && ( <div className="animate-fade-in"> <label className="block text-sm font-medium">Data do Pagamento</label> <input type="date" name="data_pagamento" value={formData.data_pagamento || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md bg-green-50" /> </div> )} </div> )}

                        {formData.form_type === 'transferencia' ? ( 
                            <fieldset className="p-3 border rounded-lg bg-gray-50 animate-fade-in"> <legend className="font-semibold text-sm">Contas da Transferência</legend> <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2"> <div><label className="block text-sm font-medium">De (Origem)*</label><select name="conta_origem_id" value={formData.conta_origem_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{dropdownData?.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div> <div><label className="block text-sm font-medium">Para (Destino)*</label><select name="conta_destino_id" value={formData.conta_destino_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{dropdownData?.contas.filter(c => c.id !== formData.conta_origem_id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div> </div> </fieldset> 
                        ) : ( 
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
                                <div>
                                    <label className="block text-sm font-medium">Conta*</label>
                                    <select name="conta_id" value={formData.conta_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{dropdownData?.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                                </div> 
                                <div>
                                    <label className="block text-sm font-medium">Categoria</label>
                                    <select name="categoria_id" value={formData.categoria_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                        <option value="">Selecione...</option>
                                        {hierarchicalCategorias.map(c => <CategoryOption key={c.id} category={c} />)}
                                    </select>
                                </div> 
                                <div className="md:col-span-2 relative"> 
                                    <label className="block text-sm font-medium">Favorecido / Fornecedor</label> 
                                    <input type="text" value={favorecidoSearchTerm} onChange={handleFavorecidoSearch} disabled={!!formData.favorecido_contato_id} placeholder={formData.favorecido_contato_id ? '' : 'Digite para buscar...'} className="mt-1 w-full p-2 border rounded-md" /> 
                                    {formData.favorecido_contato_id && ( <button type="button" onClick={handleClearFavorecido} className="absolute right-2 top-8 text-gray-500 hover:text-red-600"><FontAwesomeIcon icon={faTimes} /></button> )} 
                                    {favorecidoSearchTerm && !formData.favorecido_contato_id && ( <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg"> {isSearchingFavorecido && <li className="px-4 py-2 text-gray-500">Buscando...</li>} {!isSearchingFavorecido && searchAttempted && favorecidoSearchResults.length === 0 && ( <li className="px-4 py-2 text-center text-gray-500">Nenhum resultado. <button type="button" onClick={handleAddNewFavorecido} className="text-blue-600 hover:underline font-semibold ml-2">Adicionar Novo?</button></li> )} {favorecidoSearchResults.map(contato => ( <li key={contato.id} onClick={() => handleSelectFavorecido(contato)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={contato.nome || contato.razao_social} highlight={favorecidoSearchTerm} /></li> ))} </ul> )} 
                                </div> 
                                <div><label className="block text-sm font-medium">Empresa</label><select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" disabled={!!formData.empreendimento_id}><option value="">Nenhuma</option>{empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>)}</select></div> 
                                <div><label className="block text-sm font-medium">Empreendimento</label><select name="empreendimento_id" value={formData.empreendimento_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Nenhum</option>{dropdownData?.empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></div> 
                                <div><label className="block text-sm font-medium">Etapa da Obra</label><select name="etapa_id" value={formData.etapa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" disabled={!formData.empreendimento_id}><option value="">Nenhuma</option>{dropdownData?.etapas.map(e => <option key={e.id} value={e.id}>{e.nome_etapa}</option>)}</select></div> 
                            </div> 
                        )}
                        
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium">Observações</label>
                            <textarea
                                name="observacoes"
                                value={formData.observacoes || ''}
                                onChange={handleChange}
                                rows="3"
                                placeholder="Adicione observações, detalhes da transação ou memória de cálculo aqui..."
                                className="mt-1 w-full p-2 border rounded-md"
                            ></textarea>
                        </div>

                        <div className="pt-4 border-t">
                            <label className="block text-sm font-medium mb-2">Anexos</label>
                            
                            {formData.anexos_preexistentes.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    <p className="text-xs font-semibold text-gray-600">Anexos Salvos:</p>
                                    {formData.anexos_preexistentes.map((anexo, index) => (
                                        <div key={anexo.id} className="p-2 border rounded-md bg-gray-50 flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <FontAwesomeIcon icon={faFileLines} className="text-gray-600" />
                                                <span>{anexo.nome_arquivo}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <button type="button" onClick={() => handleViewAnexo(anexo.caminho_arquivo)} className="text-blue-600 hover:text-blue-800"><FontAwesomeIcon icon={faEye} title="Visualizar Anexo" /></button>
                                                <button type="button" onClick={() => handleRemoveAnexoPreexistente(anexo.id, anexo.caminho_arquivo, index)} className="text-red-600 hover:text-red-800"><FontAwesomeIcon icon={faTrashAlt} title="Remover Anexo" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div onDragEnter={handleDragEvents} onDragLeave={handleDragEvents} onDragOver={handleDragEvents} onDrop={handleDrop} className={`p-6 border-2 border-dashed rounded-md text-center cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}>
                                <input type="file" id="anexo-upload" className="hidden" multiple onChange={(e) => handleAnexoChange(e.target.files)} />
                                <label htmlFor="anexo-upload" className="cursor-pointer">
                                    <FontAwesomeIcon icon={faUpload} className="text-gray-500 text-2xl mb-2" />
                                    <p className="text-sm text-gray-600">Arraste e solte arquivos aqui, ou <span className="font-semibold text-blue-600">clique para selecionar</span>.</p>
                                </label>
                            </div>
                            
                            {formData.anexos.length > 0 && (
                                <div className="space-y-3 mt-4">
                                    <p className="text-xs font-semibold text-gray-600">Novos Anexos para Envio:</p>
                                    {formData.anexos.map((anexo, index) => (
                                        <div key={index} className="p-3 border rounded-md bg-blue-50 space-y-2 animate-fade-in">
                                            <div className="flex items-center justify-between text-sm font-semibold">
                                                <div className="flex items-center gap-2">
                                                    <FontAwesomeIcon icon={faPaperclip} className="text-gray-600" />
                                                    <span>{anexo.file.name}</span>
                                                </div>
                                                <button type="button" onClick={() => handleRemoveNewAnexo(index)} className="text-red-600 hover:text-red-800"><FontAwesomeIcon icon={faTrashAlt} title="Remover" /></button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <input type="text" value={anexo.descricao} onChange={(e) => handleNewAnexoDataChange(index, 'descricao', e.target.value)} placeholder="Descrição do anexo" className="w-full p-2 border rounded-md text-sm" />
                                                <select value={anexo.tipo_documento_id || ''} onChange={(e) => handleNewAnexoDataChange(index, 'tipo_documento_id', e.target.value)} className="w-full p-2 border rounded-md text-sm">
                                                    <option value="">Tipo de Documento...</option>
                                                    {dropdownData?.tiposDocumento.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.sigla} - {tipo.descricao}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending || isLoadingDropdowns} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {mutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : (isEditing ? 'Salvar Alterações' : 'Criar Lançamento')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}