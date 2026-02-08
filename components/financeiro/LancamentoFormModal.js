// components/financeiro/LancamentoFormModal.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faReceipt, faCalendarAlt, faRetweet, faExchangeAlt, 
    faArrowUp, faArrowDown, faTimes, faPaperclip, faUpload, 
    faFileLines, faEye, faTrashAlt 
} from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import { toast } from 'sonner';
import { notificarGrupo } from '@/utils/notificacoes';

// --- Componentes Auxiliares ---

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

// --- Componente Toast Personalizado para Decisão de Edição ---
const UpdateScopeToast = ({ t, onSingle, onFuture }) => (
    <div className="w-full bg-white p-1 rounded">
        <p className="font-bold text-gray-800 mb-1">Edição de Série/Parcelamento</p>
        <p className="text-sm text-gray-600 mb-3">Como deseja aplicar estas alterações?</p>
        <div className="flex gap-2">
            <button 
                onClick={() => { toast.dismiss(t); onSingle(); }} 
                className="flex-1 text-sm font-semibold px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors"
            >
                Apenas Esta
            </button>
            <button 
                onClick={() => { toast.dismiss(t); onFuture(); }} 
                className="flex-1 text-sm font-semibold px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
                Esta e Futuras
            </button>
        </div>
    </div>
);

// --- Componente Principal ---

export default function LancamentoFormModal({ isOpen, onClose, onSuccess, initialData, empresas = [] }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, organizacao_id: organizacaoId } = useAuth();
    
    // Verifica se é edição real (tem ID)
    const isEditing = Boolean(initialData?.id);
    
    // Estado Inicial Completo
    const getInitialState = () => ({
        descricao: '', 
        valor: '', 
        data_transacao: new Date().toISOString().split('T')[0],
        tipo: 'Despesa', 
        form_type: 'simples', 
        status: 'Pendente', 
        conta_id: null, 
        categoria_id: null,
        empreendimento_id: null, 
        etapa_id: null, 
        favorecido_contato_id: null,
        empresa_id: null, 
        observacoes: '',
        numero_parcelas: 2, 
        data_primeiro_vencimento: new Date().toISOString().split('T')[0],
        frequencia: 'Mensal', 
        recorrencia_data_inicio: new Date().toISOString().split('T')[0], 
        recorrencia_data_fim: null,
        novo_favorecido: null,
        anexos: [], 
        anexos_preexistentes: [],
        data_pagamento: null,
        data_vencimento: new Date().toISOString().split('T')[0],
        conta_origem_id: null,
        conta_destino_id: null,
        pedido_compra_id: null,
        // Mantemos o grupo original para referência
        parcela_grupo: null
    });

    const [formData, setFormData] = useState(getInitialState());
    const [favorecidoSearchTerm, setFavorecidoSearchTerm] = useState('');
    const [favorecidoSearchResults, setFavorecidoSearchResults] = useState([]);
    const [isSearchingFavorecido, setIsSearchingFavorecido] = useState(false);
    const [searchAttempted, setSearchAttempted] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // --- Buscas de Dados (Dropdowns) ---
    const fetchDropdownData = async () => {
        if (!organizacaoId) return null;

        const { data: contasData, error: contasError } = await supabase
            .from('contas_financeiras')
            .select('id, nome, tipo, dia_fechamento_fatura, dia_pagamento_fatura')
            .eq('organizacao_id', organizacaoId)
            .order('nome');
        if (contasError) throw new Error(contasError.message);

        const { data: categoriasData, error: categoriasError } = await supabase.from('categorias_financeiras').select('id, nome, tipo, parent_id').eq('organizacao_id', organizacaoId).order('nome');
        if (categoriasError) throw new Error(categoriasError.message);

        const { data: empreendimentosData, error: empreendimentosError } = await supabase.from('empreendimentos').select('id, nome, empresa_id:empresa_proprietaria_id').eq('organizacao_id', organizacaoId).order('nome');
        if (empreendimentosError) throw new Error(empreendimentosError.message);

        const { data: etapasData, error: etapasError } = await supabase.from('etapa_obra').select('id, nome_etapa').eq('organizacao_id', organizacaoId).order('nome_etapa');
        if (etapasError) throw new Error(etapasError.message);

        const { data: tiposDocData, error: tiposDocError } = await supabase.from('documento_tipos').select('*').eq('organizacao_id', organizacaoId).order('sigla');
        if (tiposDocError) throw new Error(tiposDocError.message);

        return { contas: contasData, categorias: categoriasData, empreendimentos: empreendimentosData, etapas: etapasData, tiposDocumento: tiposDocData };
    };

    const { data: dropdownData, isLoading: isLoadingDropdowns, error: dropdownError } = useQuery({
        queryKey: ['lancamentoDropdowns', organizacaoId],
        queryFn: fetchDropdownData,
        enabled: isOpen && !!organizacaoId,
        staleTime: 5 * 60 * 1000,
    });
    
    // --- Lógica de Data Inteligente (Cartão e Parcelado) ---
    useEffect(() => {
        if (isEditing || !dropdownData?.contas || !formData.conta_id || !formData.data_transacao) return;

        const contaSelecionada = dropdownData.contas.find(c => c.id == formData.conta_id);

        if (contaSelecionada?.tipo === 'Cartão de Crédito' && contaSelecionada.dia_fechamento_fatura && contaSelecionada.dia_pagamento_fatura) {
            
            const dataCompra = new Date(formData.data_transacao + 'T12:00:00Z');
            const diaCompra = dataCompra.getDate();
            const diaFechamento = contaSelecionada.dia_fechamento_fatura;
            const diaVencimento = contaSelecionada.dia_pagamento_fatura;

            let dataVencimentoCalculada = new Date(dataCompra);
            
            if (diaCompra >= diaFechamento) {
                dataVencimentoCalculada.setMonth(dataVencimentoCalculada.getMonth() + 1);
            }

            dataVencimentoCalculada.setDate(diaVencimento);

            if (diaVencimento < diaFechamento) {
                 dataVencimentoCalculada.setMonth(dataVencimentoCalculada.getMonth() + 1);
            }

            const novaDataVencimento = dataVencimentoCalculada.toISOString().split('T')[0];

            if (formData.form_type === 'parcelado') {
                if (formData.data_primeiro_vencimento !== novaDataVencimento) {
                    setFormData(prev => ({ ...prev, data_primeiro_vencimento: novaDataVencimento }));
                }
            } else if (formData.form_type === 'simples') {
                if (formData.data_vencimento !== novaDataVencimento) {
                    setFormData(prev => ({ ...prev, data_vencimento: novaDataVencimento }));
                }
            }
        } 
    }, [formData.conta_id, formData.data_transacao, formData.form_type, dropdownData, isEditing]);


    const sanitizeFileName = (fileName) => {
        const withoutAccents = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const sanitized = withoutAccents.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
        return sanitized;
    };

    // --- Mutation Principal (Salvar) ---
    const mutation = useMutation({
        mutationFn: async ({ formData, updateScope = 'single' }) => {
            if (!user || !organizacaoId) throw new Error("Usuário não autenticado ou organização não encontrada.");
            
            const valorNumerico = parseFloat(String(formData.valor || '0').replace(',', '.')) || 0;

            let favorecidoFinalId = formData.favorecido_contato_id;
            if (formData.novo_favorecido && formData.novo_favorecido.nome) {
                const { data: novoContato, error: contatoError } = await supabase.from('contatos').insert({ 
                    nome: formData.novo_favorecido.nome, 
                    tipo_contato: 'Fornecedor',
                    organizacao_id: organizacaoId
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
                organizacao_id: organizacaoId,
                conta_id: formData.conta_id,
                tipo: formData.tipo,
                pedido_compra_id: formData.pedido_compra_id,
                data_transacao: formData.data_transacao,
                data_vencimento: formData.data_vencimento, 
            };

            let lancamentosSalvos = [];
            let error = null;

            if (isEditing) {
                // Lógica de Atualização (Edição)
                if (updateScope === 'future' && formData.parcela_grupo) {
                    // --- MODO: ESTA E FUTURAS ---

                    // 1. Atualizar o item atual (o pivô da mudança)
                    const { data: currentData, error: currentError } = await supabase.from('lancamentos').update({ 
                        ...baseData, 
                        valor: valorNumerico,
                        status: formData.status, 
                        data_pagamento: formData.data_pagamento 
                    }).eq('id', formData.id).select();
                    
                    if (currentError) throw currentError;
                    lancamentosSalvos.push(...currentData);

                    // 2. Buscar itens futuros para aplicar a lógica de "Arrastar Datas"
                    const { data: futureItems, error: fetchError } = await supabase
                        .from('lancamentos')
                        .select('*')
                        .eq('parcela_grupo', formData.parcela_grupo)
                        .gt('data_vencimento', initialData.data_vencimento) 
                        .neq('id', formData.id);

                    if (fetchError) throw fetchError;

                    if (futureItems && futureItems.length > 0) {
                        // Calcular a diferença em dias para o VENCIMENTO
                        const oldVencDateObj = new Date(initialData.data_vencimento + 'T12:00:00Z');
                        const newVencDateObj = new Date(formData.data_vencimento + 'T12:00:00Z');
                        const diffVencMs = newVencDateObj - oldVencDateObj;

                        // Calcular a diferença em dias para a TRANSAÇÃO (CORREÇÃO AQUI)
                        const oldTransDateObj = new Date(initialData.data_transacao + 'T12:00:00Z');
                        const newTransDateObj = new Date(formData.data_transacao + 'T12:00:00Z');
                        const diffTransMs = newTransDateObj - oldTransDateObj;
                        
                        // Preparar array de upsert (atualização em massa)
                        const updates = futureItems.map(item => {
                            // Calcula a nova data de VENCIMENTO
                            const itemVencDateObj = new Date(item.data_vencimento + 'T12:00:00Z');
                            itemVencDateObj.setTime(itemVencDateObj.getTime() + diffVencMs);
                            const newItemVencDate = itemVencDateObj.toISOString().split('T')[0];

                            // Calcula a nova data de TRANSAÇÃO
                            const itemTransDateObj = new Date(item.data_transacao + 'T12:00:00Z');
                            itemTransDateObj.setTime(itemTransDateObj.getTime() + diffTransMs);
                            const newItemTransDate = itemTransDateObj.toISOString().split('T')[0];

                            return {
                                ...item, 
                                // Atualiza com os novos dados do formulário
                                valor: valorNumerico,
                                categoria_id: formData.categoria_id,
                                empreendimento_id: formData.empreendimento_id,
                                etapa_id: formData.etapa_id,
                                empresa_id: formData.empresa_id,
                                observacao: formData.observacoes,
                                favorecido_contato_id: favorecidoFinalId,
                                conta_id: formData.conta_id,
                                tipo: formData.tipo,
                                // Aplica as novas datas calculadas
                                data_vencimento: newItemVencDate,
                                data_transacao: newItemTransDate
                            };
                        });

                        const { error: batchError } = await supabase.from('lancamentos').upsert(updates);
                        if (batchError) throw batchError;
                    }

                } else {
                    // --- MODO: APENAS ESTA (SIMPLES) ---
                    const { data, error: updateError } = await supabase.from('lancamentos').update({ 
                        ...baseData, 
                        valor: valorNumerico,
                        status: formData.status, 
                        data_pagamento: formData.data_pagamento 
                    }).eq('id', formData.id).select();
                    error = updateError;
                    lancamentosSalvos = data;
                }
            } else {
                // --- Lógica de Criação (Novo) ---
                if (formData.form_type === 'transferencia') {
                    const transferenciaId = crypto.randomUUID();
                    const { data: despesaData, error: despesaError } = await supabase.from('lancamentos').insert({
                        ...baseData,
                        descricao: `Tranf. para ${dropdownData?.contas.find(c => c.id === formData.conta_destino_id)?.nome}: ${formData.descricao}`,
                        conta_id: formData.conta_origem_id,
                        valor: valorNumerico,
                        status: 'Conciliado',
                        transferencia_id: transferenciaId,
                        data_pagamento: formData.data_transacao, 
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
                            status: 'Conciliado',
                            transferencia_id: transferenciaId,
                            data_pagamento: formData.data_transacao,
                        });
                        if (receitaError) error = receitaError;
                    }
                } else if (formData.form_type === 'simples') {
                    const { data, error: insertError } = await supabase.from('lancamentos').insert({ 
                        ...baseData, 
                        valor: valorNumerico, 
                        status: formData.status,
                        data_pagamento: formData.data_pagamento 
                    }).select();
                    error = insertError;
                    lancamentosSalvos = data;
                } else if (formData.form_type === 'parcelado' || formData.form_type === 'recorrente') {
                    const grupo_id = crypto.randomUUID();
                    const lancamentosParaInserir = [];
                    const isRecorrente = formData.form_type === 'recorrente';

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
                            numeroDeLancamentos = 60; 
                        }
                    } else {
                        numeroDeLancamentos = formData.numero_parcelas;
                    }
                    
                    const valorLancamento = (valorNumerico / (isRecorrente ? 1 : formData.numero_parcelas)).toFixed(2);
                    const dataPrimeiraOcorrencia = new Date((isRecorrente ? formData.recorrencia_data_inicio : formData.data_primeiro_vencimento) + 'T12:00:00Z');

                    for (let i = 0; i < numeroDeLancamentos; i++) {
                        const dataVencimentoCalc = new Date(dataPrimeiraOcorrencia);
                        dataVencimentoCalc.setUTCMonth(dataVencimentoCalc.getUTCMonth() + i);

                        const lancamento = {
                            ...baseData,
                            descricao: `${formData.descricao} (${i + 1}/${numeroDeLancamentos})`,
                            valor: parseFloat(isRecorrente ? valorNumerico : valorLancamento),
                            data_vencimento: dataVencimentoCalc.toISOString().split('T')[0],
                            status: 'Pendente',
                            parcela_grupo: grupo_id,
                        };

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
            
            // --- Upload de Anexos ---
            if (formData.anexos.length > 0 && lancamentosSalvos.length > 0) {
                const lancamentoPrincipalId = lancamentosSalvos[0].id;
                
                const uploadPromises = formData.anexos.map(async (anexo) => {
                    if (!anexo.file) return;
                    const file = anexo.file;
                    const fileName = `${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
                    const filePath = `public/${organizacaoId}/lancamentos/${lancamentoPrincipalId}/${fileName}`;
                    
                    const { error: uploadError } = await supabase.storage.from('documentos-financeiro').upload(filePath, file);
                    if (uploadError) throw new Error(`Falha no upload do anexo ${file.name}: ${uploadError.message}`);

                    const { error: insertAnexoError } = await supabase.from('lancamentos_anexos').insert({
                        lancamento_id: lancamentoPrincipalId,
                        caminho_arquivo: filePath,
                        nome_arquivo: file.name,
                        descricao: anexo.descricao,
                        tipo_documento_id: anexo.tipo_documento_id,
                        organizacao_id: organizacaoId
                    });
                    if (insertAnexoError) throw new Error(`Falha ao salvar anexo ${file.name} no banco: ${insertAnexoError.message}`);
                });
                await Promise.all(uploadPromises);
            }
            return lancamentosSalvos;
        },
        
        onSuccess: async (data, variables) => {
            const isFutureUpdate = variables.updateScope === 'future';
            
            if (!isEditing && data && data.length > 0) {
                const lancamentoPrincipal = data[0];
                const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lancamentoPrincipal.valor);
                let tituloNotif = lancamentoPrincipal.tipo === 'Receita' ? '💰 Nova Receita' : '💸 Nova Despesa';
                await notificarGrupo({ permissao: 'financeiro', titulo: tituloNotif, mensagem: `${lancamentoPrincipal.descricao} - ${valorFormatado}`, link: '/financeiro', tipo: 'financeiro', organizacaoId: organizacaoId });
            }

            queryClient.invalidateQueries({queryKey: ['lancamentos']});
            queryClient.invalidateQueries({queryKey: ['painelCompras']});
            
            if (onSuccess) onSuccess();
            
            const msgSucesso = isFutureUpdate ? 'Datas (Transação e Vencimento) atualizadas em série!' : 'Operação realizada com sucesso!';
            toast.success(msgSucesso);
            setTimeout(onClose, 500);
        },
        onError: (err) => {
            toast.error(`Erro ao salvar: ${err.message}`);
        }
    });

    // --- Inicialização (Carregamento) ---
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                const today = new Date().toISOString().split('T')[0];
                const dataTransacaoEfetiva = initialData.data_transacao || initialData.data;
                const dataTransacaoFinal = dataTransacaoEfetiva ? new Date(dataTransacaoEfetiva).toISOString().split('T')[0] : today;
                const dataVencimentoFinal = initialData.data_vencimento ? new Date(initialData.data_vencimento).toISOString().split('T')[0] : dataTransacaoFinal;

                const dataToLoad = { 
                    ...initialData, 
                    id: initialData.id || null,
                    observacoes: initialData.observacao || '',
                    valor: initialData.valor ? String(initialData.valor).replace(',', '.') : '', 
                    data_transacao: dataTransacaoFinal,
                    data_vencimento: dataVencimentoFinal,
                    data_pagamento: initialData.data_pagamento ? new Date(initialData.data_pagamento).toISOString().split('T')[0] : null,
                    anexos_preexistentes: isEditing ? (initialData.anexos || []) : [],
                    anexos: [],
                    parcela_grupo: initialData.parcela_grupo 
                };
                setFormData({ ...getInitialState(), ...dataToLoad });
                
                if(initialData.favorecido) {
                    setFavorecidoSearchTerm(initialData.favorecido.nome || initialData.favorecido.razao_social);
                }
            } else {
                setFormData(getInitialState());
            }

            if(!initialData || !initialData.favorecido) setFavorecidoSearchTerm('');
            setFavorecidoSearchResults([]);
            setSearchAttempted(false);
        }
    }, [isOpen, initialData, isEditing]);

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (isEditing && formData.parcela_grupo) {
            toast.custom((t) => (
                <UpdateScopeToast 
                    t={t}
                    onSingle={() => mutation.mutate({ formData, updateScope: 'single' })}
                    onFuture={() => mutation.mutate({ formData, updateScope: 'future' })}
                />
            ), { duration: Infinity });
        } else {
            mutation.mutate({ formData, updateScope: 'single' });
        }
    };

    const handleValorChange = (unmaskedValue) => handleChange({ target: { name: 'valor', value: unmaskedValue } });

    const handleChange = (e) => {
        const { name, value } = e.target;
        let newFormData = { ...formData, [name]: value === '' ? null : value };
        
        if (name === 'form_type' && value === 'transferencia') {
            newFormData.tipo = 'Despesa'; 
            const transferenciaCategory = dropdownData?.categorias?.find(c => c.nome.toLowerCase() === 'transferência');
            if (transferenciaCategory) newFormData.categoria_id = transferenciaCategory.id;
        } else if (name === 'form_type' && value !== 'transferencia') {
            if (formData.form_type === 'transferencia') {
                newFormData.tipo = 'Despesa';
                const transferenciaCategory = dropdownData?.categorias?.find(c => c.nome.toLowerCase() === 'transferência');
                if (formData.categoria_id === transferenciaCategory?.id) newFormData.categoria_id = null;
            }
        }
        
        if (name === 'status' && value === 'Pago' && !newFormData.data_pagamento) { 
            newFormData.data_pagamento = new Date().toISOString().split('T')[0]; 
        }

        if (name === 'data_transacao' && formData.form_type === 'simples') {
             const contaSelecionada = dropdownData?.contas?.find(c => c.id == formData.conta_id);
             const isCartao = contaSelecionada?.tipo === 'Cartão de Crédito';
             if (!isCartao && formData.data_vencimento === formData.data_transacao) {
                 newFormData.data_vencimento = value;
             }
        }

        if (name === 'empreendimento_id') { 
            if (value && dropdownData?.empreendimentos) { const emp = dropdownData.empreendimentos.find(e => e.id == value); newFormData.empresa_id = emp?.empresa_id || null; } 
            else { newFormData.empresa_id = null; } 
            newFormData.etapa_id = null;
        }
        setFormData(newFormData);
    };
    
    // ... (Funções de Favorecido e Anexos - Mantidas Iguais) ...
    const handleFavorecidoSearch = async (e) => { const value = e.target.value; setSearchAttempted(true); setFavorecidoSearchTerm(value); if (value.length < 2 || !organizacaoId) { setFavorecidoSearchResults([]); return; } setIsSearchingFavorecido(true); const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: value, p_organizacao_id: organizacaoId }); setFavorecidoSearchResults(data || []); setIsSearchingFavorecido(false); };
    const handleSelectFavorecido = (contato) => { setFormData(prev => ({ ...prev, favorecido_contato_id: contato.id, novo_favorecido: null })); setFavorecidoSearchTerm(contato.nome || contato.razao_social); setFavorecidoSearchResults([]); };
    const handleClearFavorecido = () => { setFormData(prev => ({ ...prev, favorecido_contato_id: null, novo_favorecido: null })); setFavorecidoSearchTerm(''); };
    const handleAddNewFavorecido = () => { setFormData(prev => ({ ...prev, favorecido_contato_id: null, novo_favorecido: { nome: favorecidoSearchTerm } })); setFavorecidoSearchTerm(favorecidoSearchTerm); setFavorecidoSearchResults([]); };
    const handleAnexoChange = (files) => { if (files && files.length > 0) { const newAnexos = Array.from(files).map(file => ({ file, descricao: '', tipo_documento_id: null })); setFormData(prev => ({ ...prev, anexos: [...prev.anexos, ...newAnexos] })); } };
    const handleDragEvents = (e) => { e.preventDefault(); e.stopPropagation(); if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true); else if (e.type === "dragleave") setIsDragging(false); };
    const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { handleAnexoChange(e.dataTransfer.files); e.dataTransfer.clearData(); } };
    const handleViewAnexo = async (caminho_arquivo) => { if (!caminho_arquivo) return; try { const { data } = supabase.storage.from('documentos-financeiro').getPublicUrl(caminho_arquivo); if (data?.publicUrl) window.open(data.publicUrl, '_blank'); else throw new Error("URL pública não encontrada."); } catch (error) { toast.error("Erro ao gerar link."); } };
    const handleRemoveAnexoPreexistente = async (anexoId, caminho_arquivo, index) => { if (!window.confirm("Excluir anexo permanentemente?")) return; toast.promise(async () => { await supabase.from('lancamentos_anexos').delete().eq('id', anexoId); await supabase.storage.from('documentos-financeiro').remove([caminho_arquivo]); setFormData(prev => ({ ...prev, anexos_preexistentes: prev.anexos_preexistentes.filter((_, i) => i !== index) })); }, { loading: 'Removendo...', success: 'Removido!', error: 'Erro ao remover.' }); };
    const handleRemoveNewAnexo = (index) => { setFormData(prev => ({ ...prev, anexos: prev.anexos.filter((_, i) => i !== index) })); };
    const handleNewAnexoDataChange = (index, field, value) => { setFormData(prev => { const newAnexos = [...prev.anexos]; newAnexos[index][field] = value || null; return { ...prev, anexos: newAnexos }; }); };
    const buildHierarchy = (items, parentId = null) => items.filter(item => item.parent_id === parentId).map(item => ({ ...item, children: buildHierarchy(items, item.id) }));
    const filteredCategorias = dropdownData?.categorias?.filter(c => c.tipo === formData.tipo) || [];
    const hierarchicalCategorias = buildHierarchy(filteredCategorias);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[95vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4 text-center">{isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
                
                {isLoadingDropdowns && <p className="text-center p-3 rounded-md text-sm font-semibold mb-4 bg-blue-50 text-blue-800"><FontAwesomeIcon icon={faSpinner} spin /> Carregando dados...</p>}
                {dropdownError && <p className="text-center p-3 rounded-md text-sm font-semibold mb-4 bg-red-100 text-red-800">Erro: {dropdownError.message}</p>}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* ... (Todo o resto do formulário permanece visualmente igual ao anterior) ... */}
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
                        
                        {/* Seção Parcelado */}
                        {formData.form_type === 'parcelado' && !isEditing && ( 
                            <fieldset className="p-3 border rounded-lg bg-gray-50 animate-fade-in"> 
                                <legend className="font-semibold text-sm">Detalhes do Parcelamento</legend> 
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2"> 
                                    <div><label className="block text-sm font-medium">Valor Total *</label> <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] }}} unmask={true} name="valor" value={String(formData.valor || '')} onAccept={(v) => handleValorChange(v)} required className="w-full p-2 border rounded-md"/></div> 
                                    <div><label className="block text-sm font-medium">Data da Compra *</label> <input type="date" name="data_transacao" value={formData.data_transacao || ''} onChange={handleChange} required className="w-full p-2 border rounded-md"/></div> 
                                    <div><label className="block text-sm font-medium">Nº Parcelas *</label> <input type="number" min="2" name="numero_parcelas" value={formData.numero_parcelas} onChange={handleChange} required className="w-full p-2 border rounded-md"/></div> 
                                    <div><label className="block text-sm font-medium">1º Vencimento *</label> <input type="date" name="data_primeiro_vencimento" value={formData.data_primeiro_vencimento} onChange={handleChange} required className="w-full p-2 border rounded-md bg-yellow-50"/><p className="text-[10px] text-gray-500 mt-0.5">Calculado se for cartão.</p></div> 
                                </div> 
                            </fieldset> 
                        )}

                        {/* Seção Recorrente */}
                        {formData.form_type === 'recorrente' && !isEditing && ( 
                            <fieldset className="p-3 border rounded-lg bg-gray-50 animate-fade-in"> 
                                <legend className="font-semibold text-sm">Detalhes da Recorrência</legend> 
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2"> 
                                    <div><label className="block text-sm font-medium">Valor Parcela *</label> <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] }}} unmask={true} name="valor" value={String(formData.valor || '')} onAccept={(v) => handleValorChange(v)} required className="w-full p-2 border rounded-md"/></div> 
                                    <div><label className="block text-sm font-medium">Data Contrato</label> <input type="date" name="data_transacao" value={formData.data_transacao || ''} onChange={handleChange} required className="w-full p-2 border rounded-md"/></div>
                                    <div><label className="block text-sm font-medium">Data Início *</label> <input type="date" name="recorrencia_data_inicio" value={formData.recorrencia_data_inicio} onChange={handleChange} required className="w-full p-2 border rounded-md"/></div> 
                                    <div><label className="block text-sm font-medium">Data Fim</label> <input type="date" name="recorrencia_data_fim" value={formData.recorrencia_data_fim || ''} onChange={handleChange} className="w-full p-2 border rounded-md"/></div> 
                                </div> 
                            </fieldset> 
                        )}
                        
                        {(formData.form_type === 'simples' || formData.form_type === 'transferencia' || isEditing) && ( 
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
                                <div><label className="block text-sm font-medium">Valor *</label> <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] }}} unmask={true} name="valor" value={String(formData.valor || '')} onAccept={(v) => handleValorChange(v)} required className="w-full p-2 border rounded-md"/></div> 
                                <div><label className="block text-sm font-medium">{formData.form_type === 'transferencia' ? 'Data Transferência *' : 'Data Transação *'}</label> <input type="date" name="data_transacao" value={formData.data_transacao || ''} onChange={handleChange} required className="w-full p-2 border rounded-md"/></div> 
                            </div> 
                        )}
                        
                        {(formData.form_type === 'simples' || isEditing) && (
                            <div className="grid grid-cols-1">
                                <div>
                                    <label className="block text-sm font-medium">Data de Vencimento *</label>
                                    <input type="date" name="data_vencimento" value={formData.data_vencimento || ''} onChange={handleChange} required className="w-full p-2 border rounded-md bg-yellow-50"/>
                                    <p className="text-xs text-gray-500 mt-1">Data prevista para o débito.</p>
                                </div>
                            </div>
                        )}

                        {/* Campos Comuns (Status, Conta, Categoria, etc) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
                            <div><label className="block text-sm font-medium">Status</label> <select name="status" value={formData.status || 'Pendente'} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"> <option value="Pendente">Pendente</option> <option value="Pago">Pago</option> </select></div> 
                            {formData.status === 'Pago' && ( <div className="animate-fade-in"> <label className="block text-sm font-medium">Data do Pagamento</label> <input type="date" name="data_pagamento" value={formData.data_pagamento || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md bg-green-50" /> </div> )} 
                        </div>

                        {formData.form_type === 'transferencia' ? ( 
                            <fieldset className="p-3 border rounded-lg bg-gray-50 animate-fade-in"> <legend className="font-semibold text-sm">Contas</legend> <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2"> <div><label className="block text-sm font-medium">De (Origem)*</label><select name="conta_origem_id" value={formData.conta_origem_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{dropdownData?.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div> <div><label className="block text-sm font-medium">Para (Destino)*</label><select name="conta_destino_id" value={formData.conta_destino_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{dropdownData?.contas.filter(c => c.id !== formData.conta_origem_id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div> </div> </fieldset> 
                        ) : ( 
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
                                <div><label className="block text-sm font-medium">Conta*</label><select name="conta_id" value={formData.conta_id || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{dropdownData?.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div> 
                                <div><label className="block text-sm font-medium">Categoria</label><select name="categoria_id" value={formData.categoria_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Selecione...</option>{hierarchicalCategorias.map(c => <CategoryOption key={c.id} category={c} />)}</select></div> 
                                <div className="md:col-span-2 relative"> <label className="block text-sm font-medium">Favorecido / Fornecedor</label> <input type="text" value={favorecidoSearchTerm} onChange={handleFavorecidoSearch} disabled={!!formData.favorecido_contato_id} placeholder={formData.favorecido_contato_id ? '' : 'Digite para buscar...'} className="mt-1 w-full p-2 border rounded-md" /> {formData.favorecido_contato_id && ( <button type="button" onClick={handleClearFavorecido} className="absolute right-2 top-8 text-gray-500 hover:text-red-600"><FontAwesomeIcon icon={faTimes} /></button> )} {favorecidoSearchTerm && !formData.favorecido_contato_id && ( <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg"> {favorecidoSearchResults.map(contato => ( <li key={contato.id} onClick={() => handleSelectFavorecido(contato)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={contato.nome || contato.razao_social} highlight={favorecidoSearchTerm} /></li> ))} </ul> )} </div> 
                                <div><label className="block text-sm font-medium">Empresa</label><select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" disabled={!!formData.empreendimento_id}><option value="">Nenhuma</option>{empresas.map(e => <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>)}</select></div> 
                                <div><label className="block text-sm font-medium">Empreendimento</label><select name="empreendimento_id" value={formData.empreendimento_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md"><option value="">Nenhum</option>{dropdownData?.empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></div> 
                                <div><label className="block text-sm font-medium">Etapa da Obra</label><select name="etapa_id" value={formData.etapa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" disabled={!formData.empreendimento_id}><option value="">Nenhuma</option>{dropdownData?.etapas.map(e => <option key={e.id} value={e.id}>{e.nome_etapa}</option>)}</select></div> 
                            </div> 
                        )}
                        
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium">Observações</label>
                            <textarea name="observacoes" value={formData.observacoes || ''} onChange={handleChange} rows="3" placeholder="Detalhes..." className="mt-1 w-full p-2 border rounded-md"></textarea>
                        </div>

                        {/* Anexos - Mantido igual, apenas renderização */}
                        <div className="pt-4 border-t">
                            <label className="block text-sm font-medium mb-2">Anexos</label>
                            {formData.anexos_preexistentes.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    <p className="text-xs font-semibold text-gray-600">Salvos:</p>
                                    {formData.anexos_preexistentes.map((anexo, index) => (
                                        <div key={anexo.id} className="p-2 border rounded-md bg-gray-50 flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2"><FontAwesomeIcon icon={faFileLines} className="text-gray-600" /><span>{anexo.nome_arquivo}</span></div>
                                            <div className="flex items-center gap-4">
                                                <button type="button" onClick={() => handleViewAnexo(anexo.caminho_arquivo)} className="text-blue-600"><FontAwesomeIcon icon={faEye} /></button>
                                                <button type="button" onClick={() => handleRemoveAnexoPreexistente(anexo.id, anexo.caminho_arquivo, index)} className="text-red-600"><FontAwesomeIcon icon={faTrashAlt} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div onDragEnter={handleDragEvents} onDragLeave={handleDragEvents} onDragOver={handleDragEvents} onDrop={handleDrop} className={`p-6 border-2 border-dashed rounded-md text-center cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}>
                                <input type="file" id="anexo-upload" className="hidden" multiple onChange={(e) => handleAnexoChange(e.target.files)} />
                                <label htmlFor="anexo-upload" className="cursor-pointer">
                                    <FontAwesomeIcon icon={faUpload} className="text-gray-500 text-2xl mb-2" />
                                    <p className="text-sm text-gray-600">Arraste arquivos ou clique aqui.</p>
                                </label>
                            </div>
                            {formData.anexos.length > 0 && (
                                <div className="space-y-3 mt-4">
                                    <p className="text-xs font-semibold text-gray-600">Novos:</p>
                                    {formData.anexos.map((anexo, index) => (
                                        <div key={index} className="p-3 border rounded-md bg-blue-50 space-y-2 animate-fade-in">
                                            <div className="flex items-center justify-between text-sm font-semibold">
                                                <div className="flex items-center gap-2"><FontAwesomeIcon icon={faPaperclip} className="text-gray-600" /><span>{anexo.file.name}</span></div>
                                                <button type="button" onClick={() => handleRemoveNewAnexo(index)} className="text-red-600"><FontAwesomeIcon icon={faTrashAlt} /></button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <input type="text" value={anexo.descricao} onChange={(e) => handleNewAnexoDataChange(index, 'descricao', e.target.value)} placeholder="Descrição" className="w-full p-2 border rounded-md text-sm" />
                                                <select value={anexo.tipo_documento_id || ''} onChange={(e) => handleNewAnexoDataChange(index, 'tipo_documento_id', e.target.value)} className="w-full p-2 border rounded-md text-sm"><option value="">Tipo...</option>{dropdownData?.tiposDocumento.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.sigla} - {tipo.descricao}</option>)}</select>
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