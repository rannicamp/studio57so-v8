// components/financeiro/LancamentoFormModal.js
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { notificarGrupo } from '@/utils/notificacoes';
import { addMonths, parseISO, isValid, format } from 'date-fns';

// Importando os subcomponentes recém-criados
import TipoLancamentoSelector from './LancamentoForm/TipoLancamentoSelector';
import FormParcelado from './LancamentoForm/FormParcelado';
import FormRecorrente from './LancamentoForm/FormRecorrente';
import FormValoresEDatas from './LancamentoForm/FormValoresEDatas';
import FormCategorizacao from './LancamentoForm/FormCategorizacao';
import FormAnexos from './LancamentoForm/FormAnexos';
import { UpdateScopeToast } from './LancamentoForm/UpdateScopeToast';

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
        parcela_grupo: null,
        lancamento_ativo_id: null
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
            .select('id, nome, tipo, dia_fechamento_fatura, dia_pagamento_fatura, empresa_id')
            .eq('organizacao_id', organizacaoId)
            .order('nome');
        if (contasError) throw new Error(contasError.message);

        const { data: categoriasData, error: categoriasError } = await supabase.from('categorias_financeiras').select('id, nome, tipo, parent_id').in('organizacao_id', [organizacaoId, 1]).order('nome');
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

    // Ativos disponíveis para vínculo (apenas lançamentos de tipo Ativo)
    const { data: ativosDisponiveis = [] } = useQuery({
        queryKey: ['ativos-disponiveis', organizacaoId],
        queryFn: async () => {
            const { data } = await supabase
                .from('lancamentos')
                .select('id, descricao, valor')
                .eq('organizacao_id', organizacaoId)
                .eq('tipo', 'Ativo')
                .order('descricao');
            return data || [];
        },
        enabled: isOpen && !!organizacaoId,
        staleTime: 60 * 1000,
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
                fitid_banco: formData.fitid_banco || null,
                lancamento_ativo_id: formData.lancamento_ativo_id ? Number(formData.lancamento_ativo_id) : null,
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
                        try {
                            const oldVencDateObj = parseISO(initialData.data_vencimento);
                            const newVencDateObj = parseISO(formData.data_vencimento);
                            const diffVencMonths = (newVencDateObj.getFullYear() - oldVencDateObj.getFullYear()) * 12 + (newVencDateObj.getMonth() - oldVencDateObj.getMonth());
                            const newBaseDayVenc = newVencDateObj.getDate();

                            const oldTransDateObj = parseISO(initialData.data_transacao);
                            const newTransDateObj = parseISO(formData.data_transacao);
                            const diffTransMonths = (newTransDateObj.getFullYear() - oldTransDateObj.getFullYear()) * 12 + (newTransDateObj.getMonth() - oldTransDateObj.getMonth());
                            const newBaseDayTrans = newTransDateObj.getDate();

                            const updates = futureItems.map(item => {
                                const itemVencDateObj = parseISO(item.data_vencimento);
                                let newItemVencDateObj = addMonths(itemVencDateObj, diffVencMonths);
                                newItemVencDateObj.setDate(newBaseDayVenc);
                                const newItemVencDate = format(newItemVencDateObj, 'yyyy-MM-dd');

                                const itemTransDateObj = parseISO(item.data_transacao);
                                let newItemTransDateObj = addMonths(itemTransDateObj, diffTransMonths);
                                newItemTransDateObj.setDate(newBaseDayTrans);
                                const newItemTransDate = format(newItemTransDateObj, 'yyyy-MM-dd');

                                return {
                                    ...item,
                                    valor: valorNumerico,
                                    categoria_id: formData.categoria_id,
                                    empreendimento_id: formData.empreendimento_id,
                                    etapa_id: formData.etapa_id,
                                    empresa_id: formData.empresa_id,
                                    observacao: formData.observacoes,
                                    favorecido_contato_id: favorecidoFinalId,
                                    conta_id: formData.conta_id,
                                    tipo: formData.tipo,
                                    data_vencimento: newItemVencDate,
                                    data_transacao: newItemTransDate
                                };
                            });

                            const { error: batchError } = await supabase.from('lancamentos').upsert(updates);
                            if (batchError) throw batchError;
                        } catch (errDt) {
                            throw new Error("Erro ao recalcular datas futuras: " + errDt.message);
                        }
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
                    const baseDateString = isRecorrente ? formData.recorrencia_data_inicio : formData.data_primeiro_vencimento;
                    const dataPrimeiraOcorrenciaObj = parseISO(baseDateString);
                    const baseDay = dataPrimeiraOcorrenciaObj.getDate();

                    for (let i = 0; i < numeroDeLancamentos; i++) {
                        // Usa library pura para saltar meses fixando no dia de base (impedindo que pule para o mes seguinte equivocadamente)
                        let dataVencimentoCalc = addMonths(dataPrimeiraOcorrenciaObj, i);

                        // Garante que o dia se mantém o mesmo fixado pela 1a parcela
                        // Se for dia 31 e o mes_alvo for 28 dias, o Date normaliza.
                        if (dataVencimentoCalc.getDate() !== baseDay) {
                            // Essa lógica impede que dia 31 de janeiro vire 3 de março.
                            dataVencimentoCalc.setDate(0);
                        }

                        const lancamento = {
                            ...baseData,
                            descricao: `${formData.descricao} (${i + 1}/${numeroDeLancamentos})`,
                            valor: parseFloat(isRecorrente ? valorNumerico : valorLancamento),
                            data_vencimento: format(dataVencimentoCalc, 'yyyy-MM-dd'),
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

            queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
            queryClient.invalidateQueries({ queryKey: ['painelCompras'] });

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

                if (initialData.favorecido) {
                    setFavorecidoSearchTerm(initialData.favorecido.nome || initialData.favorecido.razao_social);
                }
            } else {
                setFormData(getInitialState());
            }

            if (!initialData || !initialData.favorecido) setFavorecidoSearchTerm('');
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
        let valToSet = value === '' ? null : value;
        let newFormData = { ...formData, [name]: valToSet };

        // Automação da Empresa
        if ((name === 'conta_id' || name === 'conta_origem_id') && valToSet) {
            const contaSelecionada = dropdownData?.contas?.find(c => c.id.toString() === valToSet.toString());
            if (contaSelecionada && contaSelecionada.empresa_id) {
                newFormData.empresa_id = contaSelecionada.empresa_id;
            }
        }

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
            if (value && dropdownData?.empreendimentos) {
                const emp = dropdownData.empreendimentos.find(e => e.id == value);
                newFormData.empresa_id = emp?.empresa_id || null;
            } else {
                const contaSelecionada = dropdownData?.contas?.find(c => c.id == newFormData.conta_id);
                newFormData.empresa_id = contaSelecionada?.empresa_id || null;
            }
            newFormData.etapa_id = null;
        }
        setFormData(newFormData);
    };

    const handleFavorecidoSearch = async (e) => { const value = e.target.value; setSearchAttempted(true); setFavorecidoSearchTerm(value); if (value.length < 2 || !organizacaoId) { setFavorecidoSearchResults([]); return; } setIsSearchingFavorecido(true); const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: value, p_organizacao_id: organizacaoId }); setFavorecidoSearchResults(data || []); setIsSearchingFavorecido(false); };
    const handleSelectFavorecido = (contato) => { setFormData(prev => ({ ...prev, favorecido_contato_id: contato.id, novo_favorecido: null })); setFavorecidoSearchTerm(contato.nome || contato.razao_social); setFavorecidoSearchResults([]); };
    const handleClearFavorecido = () => { setFormData(prev => ({ ...prev, favorecido_contato_id: null, novo_favorecido: null })); setFavorecidoSearchTerm(''); };
    //const handleAddNewFavorecido = () => { setFormData(prev => ({ ...prev, favorecido_contato_id: null, novo_favorecido: { nome: favorecidoSearchTerm } })); setFavorecidoSearchTerm(favorecidoSearchTerm); setFavorecidoSearchResults([]); };
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white rounded-t-lg z-10">
                    <h3 className="text-2xl font-bold text-gray-800">{isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
                    <button onClick={onClose} type="button" className="text-gray-400 hover:text-gray-600 p-2 rounded-full transition-colors"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
                </div>
                <div className="p-6 flex-grow overflow-y-auto">

                    {isLoadingDropdowns && <p className="text-center p-3 rounded-md text-sm font-semibold mb-4 bg-blue-50 text-blue-800"><FontAwesomeIcon icon={faSpinner} spin /> Carregando dados...</p>}
                    {dropdownError && <p className="text-center p-3 rounded-md text-sm font-semibold mb-4 bg-red-100 text-red-800">Erro: {dropdownError.message}</p>}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <TipoLancamentoSelector
                            formData={formData}
                            handleChange={handleChange}
                            isEditing={isEditing}
                        />

                        <FormParcelado
                            formData={formData}
                            handleChange={handleChange}
                            handleValorChange={handleValorChange}
                            isEditing={isEditing}
                        />

                        <FormRecorrente
                            formData={formData}
                            handleChange={handleChange}
                            handleValorChange={handleValorChange}
                            isEditing={isEditing}
                        />

                        <FormValoresEDatas
                            formData={formData}
                            handleChange={handleChange}
                            handleValorChange={handleValorChange}
                            isEditing={isEditing}
                        />

                        <FormCategorizacao
                            formData={formData}
                            handleChange={handleChange}
                            dropdownData={dropdownData}
                            empresas={empresas}
                            favorecidoSearchTerm={favorecidoSearchTerm}
                            handleFavorecidoSearch={handleFavorecidoSearch}
                            handleClearFavorecido={handleClearFavorecido}
                            handleSelectFavorecido={handleSelectFavorecido}
                            favorecidoSearchResults={favorecidoSearchResults}
                            hierarchicalCategorias={hierarchicalCategorias}
                            ativosDisponiveis={ativosDisponiveis}
                        />

                        <FormAnexos
                            formData={formData}
                            dropdownData={dropdownData}
                            handleAnexoChange={handleAnexoChange}
                            handleRemoveAnexoPreexistente={handleRemoveAnexoPreexistente}
                            handleRemoveNewAnexo={handleRemoveNewAnexo}
                            handleNewAnexoDataChange={handleNewAnexoDataChange}
                            handleViewAnexo={handleViewAnexo}
                            isDragging={isDragging}
                            handleDragEvents={handleDragEvents}
                            handleDrop={handleDrop}
                        />

                        <div className="flex justify-end gap-4 pt-4 border-t">
                            <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                            <button type="submit" disabled={mutation.isPending || isLoadingDropdowns} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                                {mutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : (isEditing ? 'Salvar Alterações' : 'Criar Lançamento')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}