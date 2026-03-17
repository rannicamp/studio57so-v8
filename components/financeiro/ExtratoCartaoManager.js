"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLandmark, faArrowUp, faArrowDown, faAngleRight, faTrash, faHandHoldingDollar, faCheckCircle, faExclamationTriangle, faFileAlt, faChevronDown, faChevronRight, faTimes, faCheck, faMagic, faEye, faExpand } from '@fortawesome/free-solid-svg-icons';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import LancamentoDetalhesSidebar from './LancamentoDetalhesSidebar';
import PanelConciliacaoCartao from './PanelConciliacaoCartao';
import { v4 as uuidv4 } from 'uuid';
import UppyFileImporter from '@/components/ui/UppyFileImporter';

// --- VISUALIZADOR DE PDF DA FATURA (igual ao LancamentoDetalhesSidebar) ---
const FaturaPreviewPanel = ({ fileUrl, fileName, onClose }) => {
    if (!fileUrl) return null;
    return (
        <div className="fixed top-0 right-0 h-full bg-gray-900 shadow-2xl z-[110] flex flex-col border-l border-gray-700 w-full md:w-[calc(100%-420px)] lg:w-[800px]">
            <div className="flex justify-between items-center p-3 bg-gray-800 text-white border-b border-gray-700">
                <h3 className="text-sm font-semibold truncate flex items-center gap-2">
                    <FontAwesomeIcon icon={faFileAlt} />
                    {fileName}
                </h3>
                <div className="flex gap-2">
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="Abrir em nova aba">
                        <FontAwesomeIcon icon={faExpand} />
                    </a>
                    <button onClick={onClose} className="p-1.5 hover:bg-red-600 rounded text-gray-400 hover:text-white transition-colors">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            </div>
            <div className="flex-1 bg-gray-800 overflow-hidden">
                <iframe src={`${fileUrl}#toolbar=0`} className="w-full h-full border-none bg-white" title="Fatura PDF" />
            </div>
        </div>
    );
};

const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function ExtratoCartaoManager({ contasCartao }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, hasPermission } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // =====================================================================
    // ESTADOS (idênticos ao ExtratoManager, adaptados para cartão)
    // =====================================================================
    const [contaSelecionadaId, setContaSelecionadaId] = useState('');
    const [isDropdownContaOpen, setIsDropdownContaOpen] = useState(false);
    const dropdownContaRef = useRef(null);
    const [faturaSelecionadaVencimento, setFaturaSelecionadaVencimento] = useState('');
    const [lancamentoSelecionado, setLancamentoSelecionado] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [ofxPainelAberto, setOfxPainelAberto] = useState(false);
    const [arquivoOfxExpandido, setArquivoOfxExpandido] = useState(null);
    const [modoConciliacaoMes, setModoConciliacaoMes] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [expandedBorderos, setExpandedBorderos] = useState({});
    const [isUppyOpen, setIsUppyOpen] = useState(false);
    const [isExtractingPDF, setIsExtractingPDF] = useState(false);
    const [previewFatura, setPreviewFatura] = useState(null); // { url, nome }

    // Auto seleção da primeira conta de cartão salva
    useEffect(() => {
        const savedId = typeof window !== 'undefined' ? localStorage.getItem('studio57_last_conta_cartao_id') : null;
        let startId = contasCartao?.[0]?.id || '';
        if (savedId && contasCartao && contasCartao.some(c => c.id == savedId)) {
            startId = savedId;
        }
        if (!contaSelecionadaId && startId) {
            setContaSelecionadaId(startId);
        }
    }, [contasCartao, contaSelecionadaId]);

    const handleSelectConta = (id) => {
        setContaSelecionadaId(id);
        if (typeof window !== 'undefined') localStorage.setItem('studio57_last_conta_cartao_id', id);
        setIsDropdownContaOpen(false);
        setFaturaSelecionadaVencimento(''); // reseta ao trocar cartão
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownContaRef.current && !dropdownContaRef.current.contains(event.target)) {
                setIsDropdownContaOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const contaSelecionada = contasCartao?.find(c => c.id == contaSelecionadaId);

    // =====================================================================
    // QUERY: FATURAS DO CARTÃO (equivale a "mesesDisponiveis" no extrato)
    // =====================================================================
    const { data: faturas = [], isLoading: isFaturasLoading } = useQuery({
        queryKey: ['faturasCartao_extrato', contaSelecionadaId, organizacaoId],
        queryFn: async () => {
            if (!contaSelecionadaId || !organizacaoId) return [];

            const conta = contasCartao?.find(c => c.id == contaSelecionadaId);
            const diaFech = conta?.dia_fechamento_fatura;
            const diaPag = conta?.dia_pagamento_fatura;

            if (diaFech && diaPag) {
                const hoje = new Date();
                let dataBase = new Date(hoje);
                if (hoje.getDate() >= diaFech) dataBase.setMonth(dataBase.getMonth() + 1);

                const upserts = [];
                for (let offset = -6; offset <= 2; offset++) {
                    const d = new Date(dataBase);
                    d.setMonth(d.getMonth() + offset);
                    const mesRef = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    let dataVenc, dataFech;
                    if (diaPag <= diaFech) {
                        const next = new Date(d);
                        next.setMonth(next.getMonth() + 1);
                        dataVenc = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(diaPag).padStart(2, '0')}`;
                        dataFech = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(diaFech).padStart(2, '0')}`;
                    } else {
                        dataVenc = `${mesRef}-${String(diaPag).padStart(2, '0')}`;
                        dataFech = `${mesRef}-${String(diaFech).padStart(2, '0')}`;
                    }
                    upserts.push({ conta_id: Number(contaSelecionadaId), mes_referencia: mesRef, data_fechamento: dataFech, data_vencimento: dataVenc, organizacao_id: organizacaoId });
                }
                await supabase.from('faturas_cartao').upsert(upserts, { onConflict: 'conta_id,mes_referencia', ignoreDuplicates: true });
            }

            const { data, error } = await supabase
                .from('faturas_cartao')
                .select('*')
                .eq('conta_id', contaSelecionadaId)
                .order('data_vencimento', { ascending: false });

            if (error) throw error;
            return data || [];
        },
        enabled: !!contaSelecionadaId && !!organizacaoId
    });

    // Auto seleciona a fatura atual (aberta ou mais recente)
    useEffect(() => {
        if (faturas.length > 0 && !faturaSelecionadaVencimento) {
            const hoje = startOfDay(new Date());
            const faturaAtiva = faturas.find(f => !isBefore(parseISO(f.data_vencimento), hoje)) || faturas[0];
            setFaturaSelecionadaVencimento(faturaAtiva.data_vencimento);
        }
    }, [faturas, faturaSelecionadaVencimento]);

    const faturaAtiva = faturas.find(f => f.data_vencimento === faturaSelecionadaVencimento);

    // =====================================================================
    // QUERY: EXTRATO DA FATURA (equivale à query 'extrato' do ExtratoManager)
    // busca lançamentos da fatura_id, calcula totais e agrupa borderôs
    // =====================================================================
    const { data: extratoData, isLoading } = useQuery({
        queryKey: ['extrato_cartao', contaSelecionadaId, faturaSelecionadaVencimento, organizacaoId],
        queryFn: async () => {
            if (!contaSelecionadaId || !organizacaoId || !faturaAtiva) return null;

            const { data: lancamentos, error } = await supabase
                .from('lancamentos')
                .select('*, favorecido:contatos!favorecido_contato_id(*), categoria:categorias_financeiras(*), anexos:lancamentos_anexos(*)')
                .eq('conta_id', Number(contaSelecionadaId))
                .eq('organizacao_id', organizacaoId)
                .eq('fatura_id', faturaAtiva.id)
                .order('data_transacao', { ascending: true })
                .order('data_vencimento', { ascending: true })
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Agrupamento de Borderô e Totais (idêntico ao ExtratoManager)
            let totalDespesas = 0;
            let totalCreditos = 0;

            const borderosMap = {};
            const itensFinais = [];

            (lancamentos || []).forEach(lanc => {
                const valorAbsoluto = Math.abs(Number(lanc.valor));
                const entrada = lanc.tipo === 'Receita' ? valorAbsoluto : 0;
                const saida = lanc.tipo === 'Despesa' ? valorAbsoluto : 0;
                totalDespesas += saida;
                totalCreditos += entrada;

                const status_exibicao = lanc.fitid_banco ? 'Conciliado' : lanc.status;
                const l = { ...lanc, entrada, saida, status_exibicao };

                if (l.agrupamento_id) {
                    if (!borderosMap[l.agrupamento_id]) {
                        const dataRef = l.data_transacao || l.data_vencimento;
                        const paiFicticio = {
                            id: l.agrupamento_id,
                            isBordero: true,
                            isExpanded: false,
                            agrupamento_id: l.agrupamento_id,
                            descricao: 'Borderô de Lançamentos',
                            tipo: l.tipo,
                            valorTotal: 0,
                            data_pagamento: dataRef,
                            filhos: [],
                            saldo_acumulado: 0,
                            status_exibicao: 'Misto'
                        };
                        borderosMap[l.agrupamento_id] = paiFicticio;
                        itensFinais.push(paiFicticio);
                    }
                    borderosMap[l.agrupamento_id].filhos.push(l);
                    borderosMap[l.agrupamento_id].valorTotal += valorAbsoluto;
                } else {
                    itensFinais.push(l);
                }
            });

            Object.values(borderosMap).forEach(b => {
                b.descricao = `Borderô - ${b.filhos.length} lançamentos (${b.tipo === 'Despesa' ? 'Pagamentos' : 'Recebimentos'})`;
                const todosConciliados = b.filhos.every(f => f.status_exibicao === 'Conciliado');
                const algumConciliado = b.filhos.some(f => f.status_exibicao === 'Conciliado');
                if (todosConciliados) b.status_exibicao = 'Conciliado';
                else if (algumConciliado) b.status_exibicao = 'Parcial';
                else b.status_exibicao = 'Pendente';

                if (b.tipo === 'Despesa') { b.saida = b.valorTotal; b.entrada = 0; }
                else { b.entrada = b.valorTotal; b.saida = 0; }
            });

            return {
                entradas: totalCreditos,
                saidas: totalDespesas,
                saldoFatura: totalDespesas - totalCreditos,
                itens: itensFinais
            };
        },
        enabled: !!contaSelecionadaId && !!organizacaoId && !!faturaAtiva
    });

    // =====================================================================
    // QUERY: ARQUIVOS OFX/IA DA CONTA (idêntico ao ExtratoManager)
    // =====================================================================
    const { data: arquivosOfxMes } = useQuery({
        queryKey: ['ofx_arquivos_cartao', contaSelecionadaId, organizacaoId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('banco_arquivos_ofx')
                .select('*')
                .eq('conta_id', Number(contaSelecionadaId))
                .eq('organizacao_id', organizacaoId)
                .order('periodo_inicio', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!contaSelecionadaId && !!organizacaoId
    });

    // =====================================================================
    // MUTATIONS (idênticas ao ExtratoManager)
    // =====================================================================
    const exclusaoMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('lancamentos').delete().eq('id', id).eq('organizacao_id', organizacaoId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Lançamento excluído com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
        },
        onError: (err) => toast.error(`Erro ao excluir: ${err.message}`)
    });

    const handleDelete = (e, item) => {
        e.stopPropagation();
        if (window.confirm(`Deseja realmente excluir o lançamento "${item.descricao}"?`)) {
            exclusaoMutation.mutate(item.id);
        }
    };

    const exclusaoOfxMutation = useMutation({
        mutationFn: async (arquivoId) => {
            // Garante que todas as transações importadas pela IA sejam excluídas primeiro
            await supabase.from('banco_transacoes_ofx').delete().eq('arquivo_id', arquivoId).eq('organizacao_id', organizacaoId);

            const { error } = await supabase.from('banco_arquivos_ofx').delete().eq('id', arquivoId).eq('organizacao_id', organizacaoId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Arquivo IA e suas transações excluídos!');
            setArquivoOfxExpandido(null);
            queryClient.invalidateQueries({ queryKey: ['ofx_arquivos_cartao'] });
            queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
        },
        onError: (err) => toast.error(`Erro ao excluir arquivo: ${err.message}`)
    });

    const handleDeleteOfx = (e, arq) => {
        e.stopPropagation();
        if (window.confirm(`Deseja realmente excluir o arquivo "${arq.nome_arquivo}"? Todas as suas transações serão apagadas da base.`)) {
            exclusaoOfxMutation.mutate(arq.id);
        }
    };

    // =====================================================================
    // BORDERÔ (idêntico ao ExtratoManager)
    // =====================================================================
    const toggleSelectAll = () => {
        if (!extratoData || extratoData.itens.length === 0) return;
        if (selectedIds.length === extratoData.itens.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(extratoData.itens.map(i => i.id));
        }
    };

    const toggleSelectRow = (e, id) => {
        e.stopPropagation();
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const criarBorderoMutation = useMutation({
        mutationFn: async () => {
            if (selectedIds.length < 2) throw new Error("Selecione pelo menos 2 lançamentos para agrupar.");
            const novoBorderoId = uuidv4();
            const { error } = await supabase.from('lancamentos').update({ agrupamento_id: novoBorderoId }).in('id', selectedIds).eq('organizacao_id', organizacaoId);
            if (error) throw error;
            return selectedIds.length;
        },
        onSuccess: (qtde) => {
            toast.success(`${qtde} Lançamentos agrupados com sucesso!`);
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
        },
        onError: (err) => toast.error(`Erro ao criar borderô: ${err.message}`)
    });

    const handleCriarBordero = () => {
        if (window.confirm(`Tem certeza que deseja agrupar ${selectedIds.length} lançamentos em um único Borderô?`)) {
            criarBorderoMutation.mutate();
        }
    };

    const toggleBordero = (e, borderoId) => {
        e.stopPropagation();
        setExpandedBorderos(prev => ({ ...prev, [borderoId]: !prev[borderoId] }));
    };

    const desagruparBorderoCompletoMutation = useMutation({
        mutationFn: async (borderoId) => {
            const { error } = await supabase.from('lancamentos').update({ agrupamento_id: null }).eq('agrupamento_id', borderoId).eq('organizacao_id', organizacaoId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Borderô desfeito com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
        }
    });

    const desagruparIndividualMutation = useMutation({
        mutationFn: async (lancamentoId) => {
            const { error } = await supabase.from('lancamentos').update({ agrupamento_id: null }).eq('id', lancamentoId).eq('organizacao_id', organizacaoId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Lançamento removido do borderô!');
            queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
        }
    });

    const handleDesagruparBordero = (e, borderoId) => {
        e.stopPropagation();
        if (window.confirm("Deseja realmente desfazer este Borderô? Os lançamentos continuarão existindo separadamente.")) {
            desagruparBorderoCompletoMutation.mutate(borderoId);
        }
    };

    const handleRemoverDoBordero = (e, lancamentoId) => {
        e.stopPropagation();
        if (window.confirm("Retirar este lançamento específico do Borderô?")) {
            desagruparIndividualMutation.mutate(lancamentoId);
        }
    };

    const handleRowClick = (item) => {
        if (item.isBordero) {
            setExpandedBorderos(prev => ({ ...prev, [item.id]: !prev[item.id] }));
        } else {
            setLancamentoSelecionado(item);
            setIsSidebarOpen(true);
        }
    };

    // =====================================================================
    // IMPORTAÇÃO DE PDF VIA IA (troca de OfxUploader)
    // =====================================================================
    const handlePdfUpload = async (files) => {
        setIsUppyOpen(false);
        const fileArray = Array.isArray(files) ? files : [files];
        if (fileArray.length === 0) return;

        setIsExtractingPDF(true);
        const toastId = toast.loading(`Processando ${fileArray.length} fatura(s) com IA...`);

        let totalInjected = 0;
        let firstDataVencimento = null;
        const cartoesNaoEncontrados = []; // Rastreia cartões da IA não mapeados no sistema

        for (let i = 0; i < fileArray.length; i++) {
            const file = fileArray[i];
            toast.loading(`🧠 IA lendo fatura ${i + 1} de ${fileArray.length}: ${file.name}`, { id: toastId });

            if (i > 0) {
                toast.loading(`⏳ Aguardando 4s para evitar limite da IA...`, { id: toastId });
                await new Promise(r => setTimeout(r, 4000));
                toast.loading(`🧠 Processando fatura ${i + 1} de ${fileArray.length}...`, { id: toastId });
            }

            try {
                const formData = new FormData();
                formData.append('file', file);

                const res = await fetch('/api/cartoes/extrair-fatura', { method: 'POST', body: formData });
                const result = await res.json();
                if (!res.ok) { console.error(`Erro na fatura ${file.name}:`, result.error); continue; }

                if (result.extratos && result.extratos.length > 0) {
                    for (const extrato of result.extratos) {
                        const finalDigits = extrato.cartao_final ? String(extrato.cartao_final).trim() : '';
                        let matchedContaId = null;

                        if (finalDigits.length >= 4) {
                            // 1º: tenta casar com a lista passada via props (já carregada)
                            const found = contasCartao?.find(c => c.numero_conta && String(c.numero_conta).endsWith(finalDigits));
                            if (found) matchedContaId = found.id;

                            // 2º: Se não achou nas props, busca no banco (evita criar duplicata)
                            if (!matchedContaId) {
                                const { data: contaBD } = await supabase
                                    .from('contas_financeiras')
                                    .select('id, nome, numero_conta')
                                    .eq('organizacao_id', organizacaoId)
                                    .ilike('numero_conta', `%${finalDigits}`)
                                    .limit(1)
                                    .single();
                                if (contaBD) matchedContaId = contaBD.id;
                            }
                        }

                        // SE não encontrou a conta, cria automaticamente com dados da IA
                        if (!matchedContaId) {
                            if (finalDigits) {
                                const nomeContaIA = `${extrato.bandeira || 'Cartão'} Final ${finalDigits} - ${extrato.titular || 'Titular'}`;
                                const diaFechamento = extrato.data_fechamento_fatura
                                    ? parseInt(extrato.data_fechamento_fatura.split('-')[2])
                                    : null;
                                const diaPagamento = extrato.data_vencimento_fatura
                                    ? parseInt(extrato.data_vencimento_fatura.split('-')[2])
                                    : null;

                                const { data: novaConta, error: errConta } = await supabase
                                    .from('contas_financeiras')
                                    .insert({
                                        nome: `⚠️ ${nomeContaIA}`,
                                        tipo: 'Cartão de Crédito',
                                        numero_conta: finalDigits,
                                        instituicao: extrato.instituicao || extrato.bandeira || null,
                                        dia_fechamento_fatura: diaFechamento,
                                        dia_pagamento_fatura: diaPagamento,
                                        limite_credito: extrato.limite_credito || null,
                                        saldo_inicial: 0,
                                        organizacao_id: organizacaoId,
                                    })
                                    .select('*')
                                    .single();

                                if (!errConta && novaConta) {
                                    matchedContaId = novaConta.id;
                                    cartoesNaoEncontrados.push({
                                        cartao: finalDigits,
                                        titular: extrato.titular,
                                        nomeConta: novaConta.nome,
                                        contaCriada: true
                                    });
                                    queryClient.invalidateQueries({ queryKey: ['contasCartao'] });
                                    queryClient.invalidateQueries({ queryKey: ['contas'] });
                                } else {
                                    console.error('Erro ao criar conta:', errConta);
                                    matchedContaId = contaSelecionadaId;
                                    cartoesNaoEncontrados.push({
                                        cartao: finalDigits,
                                        titular: extrato.titular,
                                        contaFallback: contaSelecionada?.nome,
                                        contaCriada: false
                                    });
                                }
                            } else {
                                matchedContaId = contaSelecionadaId;
                            }
                        }

                        // ⚠️ Log de diagnóstico do que a IA retornou
                        console.log(`[IA] cartao_final="${extrato.cartao_final}" matchedContaId=${matchedContaId} lancamentos=${extrato.lancamentos?.length ?? 'null'}`);

                        // Se não achou a conta, pula completamente
                        if (!matchedContaId) { console.warn('[IA] Conta não encontrada — pulando extrato.'); continue; }

                        const dataVencimentoIA = extrato.data_vencimento_fatura || faturaSelecionadaVencimento;
                        if (!dataVencimentoIA) { console.warn('[IA] Sem data de vencimento — pulando.'); continue; }

                        if (!firstDataVencimento) firstDataVencimento = dataVencimentoIA;

                        // GARANTE que a fatura exista na tabela faturas_cartao para essa data
                        const mesRef = dataVencimentoIA.substring(0, 7);
                        await supabase.from('faturas_cartao').upsert({
                            conta_id: Number(matchedContaId),
                            organizacao_id: organizacaoId,
                            mes_referencia: mesRef,
                            data_vencimento: dataVencimentoIA,
                            data_fechamento: dataVencimentoIA,
                            status: 'Fechada'
                        }, { onConflict: 'conta_id,mes_referencia', ignoreDuplicates: true });

                        const nomeArq = file.name || `Fatura_Cartao_${finalDigits || 'Desconhecido'}_Venc_${dataVencimentoIA}.pdf`;
                        const storagePath = `faturas-cartao/${organizacaoId}/${matchedContaId}_${dataVencimentoIA}_${Date.now()}.pdf`;

                        // Faz upload do PDF original ao Supabase Storage
                        let arquivoUrl = null;
                        const { error: uploadError } = await supabase.storage
                            .from('documentos-financeiro')
                            .upload(storagePath, file, { contentType: 'application/pdf', upsert: true });
                        if (!uploadError) {
                            const { data: urlData } = supabase.storage.from('documentos-financeiro').getPublicUrl(storagePath);
                            arquivoUrl = urlData?.publicUrl || null;
                        } else {
                            console.warn('Upload PDF Storage falhou (segue sem URL):', uploadError.message);
                        }

                        await supabase.from('banco_arquivos_ofx').delete()
                            .eq('conta_id', matchedContaId).eq('nome_arquivo', nomeArq).eq('organizacao_id', organizacaoId);

                        const { data: arqHeader, error: arqError } = await supabase.from('banco_arquivos_ofx').insert({
                            organizacao_id: organizacaoId, conta_id: matchedContaId,
                            nome_arquivo: nomeArq, status: 'Processado IA',
                            periodo_inicio: dataVencimentoIA, periodo_fim: dataVencimentoIA,
                            arquivo_url: arquivoUrl  // URL pública completa para visualização direta
                        }).select('*').single();

                        if (arqError) { console.error('Erro OFX Header:', arqError); continue; }

                        const payloadTransacoes = extrato.lancamentos.map((l, index) => {
                            const safeDateTrans = l.data_transacao || dataVencimentoIA;
                            const dateTransStr = safeDateTrans.replace(/-/g, '');
                            const dateVencStr = dataVencimentoIA.replace(/-/g, '');
                            const tipoLetra = l.tipo === 'Despesa' ? 'D' : 'R';
                            const fitidFormatado = `CC-${finalDigits || '0000'}-${dateVencStr}-${dateTransStr}-${l.valor}-${tipoLetra}-${index}`;

                            return {
                                fitid: fitidFormatado,
                                arquivo_id: arqHeader.id, organizacao_id: organizacaoId, conta_id: matchedContaId,
                                data_transacao: safeDateTrans,
                                valor: l.tipo === 'Despesa' ? -Math.abs(l.valor) : Math.abs(l.valor),
                                tipo: l.tipo,
                                descricao_banco: l.descricao || 'Compra Cartão',
                                memo_banco: `Fatura Proc. IA: ${extrato.titular || 'Titular'}`
                            };
                        });

                        // Insere transações apenas se houver lançamentos
                        if (!extrato.lancamentos || extrato.lancamentos.length === 0) {
                            console.warn('[IA] Arquivo salvo mas sem lançamentos — verifique o texto extraído do PDF.');
                            totalInjected++; // conta como processado mesmo sem lançamentos (arquivo existirá visível)
                        } else if (payloadTransacoes.length > 0) {
                            const { error: trError } = await supabase.from('banco_transacoes_ofx').upsert(payloadTransacoes, { onConflict: 'fitid' });
                            if (trError) console.error('[IA] Erro ao inserir transações:', trError.message);
                            else totalInjected++;
                        }
                    }
                }
            } catch (err) {
                console.error(`Falha ao processar ${file.name}:`, err);
            }
        }

        // Toast final com detalhes de criação automática
        const contasCriadas = cartoesNaoEncontrados.filter(c => c.contaCriada);
        const contasFalha = cartoesNaoEncontrados.filter(c => !c.contaCriada);

        if (contasCriadas.length > 0 || contasFalha.length > 0) {
            toast.success(`✅ ${fileArray.length} fatura(s) processadas!`, { id: toastId });
            contasCriadas.forEach(c => {
                toast.warning(
                    `🆕 Cartão final "${c.cartao}" (${c.titular || 'desconhecido'}) não existia no sistema. Conta "${c.nomeConta}" criada automaticamente! Acesse Configurações > Contas para completar os dados.`,
                    { duration: 12000 }
                );
            });
            contasFalha.forEach(c => {
                toast.error(
                    `❌ Cartão final "${c.cartao}" não encontrado e não foi possível criar a conta. Lançamentos salvos em "${c.contaFallback}" como fallback.`,
                    { duration: 10000 }
                );
            });
        } else {
            toast.success(`✅ ${fileArray.length} fatura(s) processadas! ${totalInjected} cartão(ões) — todos reconhecidos automaticamente! 🎉`, { id: toastId });
        }

        if (firstDataVencimento) setFaturaSelecionadaVencimento(firstDataVencimento);

        // Recarrega faturas (nova entrada pode ter sido criada) e arquivos IA
        queryClient.invalidateQueries({ queryKey: ['faturasCartao_extrato'] });
        queryClient.invalidateQueries({ queryKey: ['ofx_arquivos_cartao'] });

        setIsExtractingPDF(false);
    };

    // =====================================================================
    // RENDER
    // =====================================================================
    return (
        <>
            {/* VISUALIZADOR PDF DA FATURA */}
            <FaturaPreviewPanel
                fileUrl={previewFatura?.url}
                fileName={previewFatura?.nome}
                onClose={() => setPreviewFatura(null)}
            />
            {previewFatura && (
                <div className="fixed inset-0 bg-black/50 z-[100]" onClick={() => setPreviewFatura(null)} />
            )}

            <div className="space-y-6 animate-fadeIn">
            {/* CABEÇALHO UNIFICADO (idêntico ao ExtratoManager) */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="bg-blue-100 p-3 rounded-full text-blue-600 hidden md:block">
                    <FontAwesomeIcon icon={faLandmark} size="lg" />
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selecionar Cartão de Crédito</label>
                    <div className="relative w-full xl:w-2/3" ref={dropdownContaRef}>
                        <button
                            onClick={() => setIsDropdownContaOpen(!isDropdownContaOpen)}
                            className="w-full text-left bg-white border-2 border-gray-200 hover:border-indigo-300 rounded-xl p-3 flex items-center justify-between transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {contaSelecionada ? (
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm text-gray-800">{contaSelecionada.nome}</span>
                                    <span className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5">
                                        {contaSelecionada.empresa?.nome_fantasia || 'Sem Empresa'} • {contaSelecionada.tipo}
                                        {contaSelecionada.numero_conta && ` • Final ${contaSelecionada.numero_conta}`}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-gray-500 text-sm font-semibold">-- Selecione um cartão --</span>
                            )}
                            <FontAwesomeIcon icon={faChevronDown} className={`text-gray-400 text-sm transition-transform duration-200 ${isDropdownContaOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isDropdownContaOpen && (
                            <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-[350px] overflow-y-auto p-1 origin-top animate-fadeIn">
                                {(contasCartao || []).map(c => {
                                    const isSelected = contaSelecionadaId === c.id;
                                    const isIncompleta = c.nome?.startsWith('⚠️');
                                    const nomeExibicao = c.nome?.replace('⚠️ ', '') || c.nome;
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => handleSelectConta(c.id)}
                                            className={`w-full text-left flex items-start justify-between p-2.5 rounded-lg border transition-all duration-200 ${
                                                isIncompleta
                                                    ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
                                                    : isSelected
                                                        ? 'bg-indigo-50/80 border-indigo-200 shadow-sm'
                                                        : 'border-transparent bg-transparent hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex flex-col flex-1 pr-2 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`font-bold text-[13px] leading-tight truncate ${isSelected ? 'text-indigo-900' : isIncompleta ? 'text-amber-900' : 'text-gray-700'}`}>
                                                        {nomeExibicao}
                                                    </span>
                                                    {isIncompleta && (
                                                        <span className="flex-shrink-0 text-[8px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                                                            Incompleta
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[9px] text-gray-400 mt-0.5">
                                                    {isIncompleta ? '⚠️ Criada pela IA — preencha os dados pendentes' : `${c.empresa?.nome_fantasia || ''}${c.numero_conta ? ` • Final ${c.numero_conta}` : ''}`}
                                                </span>
                                            </div>
                                            {isSelected && !isIncompleta && <FontAwesomeIcon icon={faCheck} className="text-indigo-500 text-[10px] mt-0.5" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {contaSelecionada && (
                    <div className="text-right flex items-center gap-4 w-full md:w-auto justify-between md:justify-end mt-4 md:mt-0">
                        {/* Botão IA PDF (troca do OfxUploader) */}
                        <button
                            onClick={() => setIsUppyOpen(true)}
                            disabled={isExtractingPDF}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-60"
                        >
                            {isExtractingPDF ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faMagic} />}
                            Importar Fatura PDF (IA)
                        </button>

                        {/* Cards de Totais da Fatura */}
                        {extratoData && (
                            <>
                                <div className="bg-red-50 p-2 md:p-3 rounded-lg border border-red-100 shadow-sm">
                                    <p className="text-[10px] md:text-xs text-red-700 uppercase font-semibold">
                                        <FontAwesomeIcon icon={faArrowDown} className="mr-1" /> Despesas (Fatura)
                                    </p>
                                    <p className="text-sm md:text-lg font-bold text-red-600">-{formatCurrency(extratoData.saidas)}</p>
                                </div>
                                <div className="bg-green-50 p-2 md:p-3 rounded-lg border border-green-100 shadow-sm">
                                    <p className="text-[10px] md:text-xs text-green-700 uppercase font-semibold">
                                        <FontAwesomeIcon icon={faArrowUp} className="mr-1" /> Créditos (Fatura)
                                    </p>
                                    <p className="text-sm md:text-lg font-bold text-green-600">+{formatCurrency(extratoData.entradas)}</p>
                                </div>
                                <div className="bg-blue-50 p-2 md:p-3 rounded-lg border border-blue-200 shadow-sm">
                                    <p className="text-[10px] md:text-xs text-blue-700 uppercase font-semibold">Total da Fatura</p>
                                    <p className="text-sm md:text-lg font-bold text-blue-800">{formatCurrency(extratoData.saldoFatura)}</p>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* CONTEÚDO: Grid 1/4 - 3/4 (idêntico ao ExtratoManager) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

                {/* LADO ESQUERDO: Seletor de Faturas (troca de Meses) */}
                <div className="lg:col-span-1 space-y-3">
                    <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Faturas do Cartão</h3>
                    <div className="bg-white border text-sm rounded-lg flex flex-col shadow-sm max-h-[75vh] overflow-y-auto custom-scrollbar">
                        {isFaturasLoading ? (
                            <div className="p-6 text-center"><FontAwesomeIcon icon={faSpinner} spin className="text-blue-400" /></div>
                        ) : faturas.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-xs">Nenhuma fatura encontrada para este cartão.</div>
                        ) : (
                            faturas.map((fatura, idx) => {
                                const isSelected = fatura.data_vencimento === faturaSelecionadaVencimento;
                                const hoje = startOfDay(new Date());
                                const dataVenc = parseISO(fatura.data_vencimento);
                                const isAtrasada = isBefore(dataVenc, hoje);
                                const faturaKey = fatura.data_vencimento;

                                // Arquivos IA para esta fatura (compara pelo periodo_inicio)
                                const arquivosFatura = (arquivosOfxMes || []).filter(a => a.periodo_inicio === fatura.data_vencimento);
                                const ofxAberto = ofxPainelAberto === faturaKey;

                                return (
                                    <div key={idx} className={`border-b last:border-0 transition-all border-l-4 ${isSelected ? 'border-l-blue-500' : 'border-l-transparent'}`}>
                                        <div className={`flex items-center ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}>
                                            <button
                                                onClick={() => { setFaturaSelecionadaVencimento(fatura.data_vencimento); setModoConciliacaoMes(null); setArquivoOfxExpandido(null); setSelectedIds([]); }}
                                                className="flex-1 text-left p-4"
                                            >
                                                <div className={`font-bold capitalize ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                                    Venc. {format(parseISO(fatura.data_vencimento), 'dd/MM/yyyy')}
                                                </div>
                                                <div className="mt-1 flex gap-1 flex-wrap">
                                                    {isAtrasada ? (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-red-100 text-red-700">Atrasada</span>
                                                    ) : (
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                                            {idx === 0 ? 'Atual' : 'Anterior'}
                                                        </span>
                                                    )}
                                                    {arquivosFatura.length > 0 && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-purple-100 text-purple-700">
                                                            <FontAwesomeIcon icon={faMagic} className="mr-1" />IA
                                                        </span>
                                                    )}
                                                </div>
                                            </button>

                                            {/* Botão Conciliar (aparece quando tem arquivo IA) */}
                                            {arquivosFatura.length > 0 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFaturaSelecionadaVencimento(fatura.data_vencimento);
                                                        setModoConciliacaoMes(faturaKey);
                                                    }}
                                                    className={`mr-2 px-3 py-1.5 transition-all text-xs font-bold rounded-lg border flex items-center gap-1 shadow-sm
                                                        ${modoConciliacaoMes === faturaKey ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
                                                    title="Conciliar esta fatura"
                                                >
                                                    <FontAwesomeIcon icon={faHandHoldingDollar} />
                                                    <span className="hidden sm:inline">Conciliar</span>
                                                </button>
                                            )}

                                            {/* Seta de arquivos IA */}
                                            {arquivosFatura.length > 0 && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setOfxPainelAberto(ofxAberto ? null : faturaKey); setArquivoOfxExpandido(null); }}
                                                    className={`pr-3 pl-2 py-4 transition-colors flex items-center gap-1 text-[10px] font-bold border-l
                                                        ${ofxAberto ? 'text-indigo-600' : 'text-gray-300 hover:text-indigo-400'}`}
                                                    title="Ver arquivos IA desta fatura"
                                                >
                                                    <FontAwesomeIcon icon={faFileAlt} />
                                                    <span>{arquivosFatura.length}</span>
                                                    <FontAwesomeIcon icon={ofxAberto ? faChevronDown : faChevronRight} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Expansão dos Arquivos IA */}
                                        {ofxAberto && (
                                            <div className="bg-indigo-50/60 border-t border-indigo-100 px-3 py-2 flex flex-col gap-1.5">
                                                {arquivosFatura.map(arq => (
                                                    <div
                                                        key={arq.id}
                                                        className="w-full group rounded-lg border transition-all flex items-stretch overflow-hidden bg-white/70 border-indigo-100 hover:border-indigo-300 hover:shadow-sm"
                                                    >
                                                        {/* Clique no card abre o PDF */}
                                                        <button
                                                            className="flex-1 text-left px-3 py-2 text-xs flex items-center gap-2 min-w-0 hover:bg-indigo-50/50 transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (arq.arquivo_url) {
                                                                    // URL pública completa salva diretamente
                                                                    setPreviewFatura({ url: arq.arquivo_url, nome: arq.nome_arquivo });
                                                                } else {
                                                                    toast.info('PDF não disponível para visualização. Reimporte a fatura para habilitar.');
                                                                }
                                                            }}
                                                            title={arq.arquivo_url ? 'Clique para visualizar o PDF' : 'PDF não disponível (reimporte para habilitar)'}
                                                        >
                                                            <FontAwesomeIcon
                                                                icon={arq.arquivo_url ? faEye : faFileAlt}
                                                                className={`flex-shrink-0 text-xs ${arq.arquivo_url ? 'text-indigo-500' : 'text-indigo-300'}`}
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-bold text-gray-800 truncate text-[11px]" title={arq.nome_arquivo}>{arq.nome_arquivo}</p>
                                                                <p className="text-[9px] text-gray-400">
                                                                    {arq.arquivo_url ? '👁️ Clique para visualizar' : '📄 Sem preview — reimporte'} • {arq.data_envio ? format(parseISO(arq.data_envio), 'dd/MM/yy HH:mm') : '?'}
                                                                </p>
                                                            </div>
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeleteOfx(e, arq)}
                                                            className="px-3 flex-shrink-0 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-transparent group-hover:border-indigo-100"
                                                            title="Apagar arquivo IA do banco"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* LADO DIREITO: Extrato da Fatura OU Painel de Conciliação */}
                <div className="lg:col-span-3">
                    {modoConciliacaoMes ? (
                        // MODO CONCILIAÇÃO (troca de PanelConciliacaoOFX por PanelConciliacaoCartao)
                        <PanelConciliacaoCartao
                            contas={contasCartao}
                            initialContaId={contaSelecionadaId}
                            faturaVencimento={faturaSelecionadaVencimento}
                            onClosePanel={() => setModoConciliacaoMes(null)}
                        />
                    ) : isLoading ? (
                        <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200 text-center">
                            <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
                            <p className="text-gray-500 mt-2">Carregando lançamentos da fatura...</p>
                        </div>
                    ) : extratoData ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Resumo da Fatura (TopBar) */}
                            <div className="p-6 border-b bg-gradient-to-br from-gray-50 to-white">
                                <h2 className="text-xl font-bold text-gray-800 capitalize mb-4">
                                    Lançamentos da Fatura — Venc. {faturaSelecionadaVencimento ? format(parseISO(faturaSelecionadaVencimento), 'dd/MM/yyyy') : ''}
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 shadow-sm">
                                        <p className="text-[10px] font-bold text-red-700 uppercase"><FontAwesomeIcon icon={faArrowDown} className="mr-1" /> Despesas</p>
                                        <p className="text-sm font-semibold text-red-700 mt-1">-{formatCurrency(extratoData.saidas)}</p>
                                    </div>
                                    <div className="bg-green-50 p-3 rounded-lg border border-green-100 shadow-sm">
                                        <p className="text-[10px] font-bold text-green-700 uppercase"><FontAwesomeIcon icon={faArrowUp} className="mr-1" /> Créditos / Estornos</p>
                                        <p className="text-sm font-semibold text-green-700 mt-1">+{formatCurrency(extratoData.entradas)}</p>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 shadow-sm">
                                        <p className="text-[10px] font-bold text-blue-700 uppercase">Total a Pagar</p>
                                        <p className={`text-sm font-bold mt-1 ${extratoData.saldoFatura < 0 ? 'text-red-600' : 'text-blue-800'}`}>
                                            {formatCurrency(extratoData.saldoFatura)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Barra de Ação Flutuante (Borderô) */}
                            {selectedIds.length > 0 && (
                                <div className="bg-indigo-600 text-white p-3 flex items-center justify-between animate-fadeIn sticky top-0 z-10 shadow-md">
                                    <div className="flex items-center gap-3">
                                        <span className="bg-indigo-800 text-xs font-bold px-2 py-1 rounded-full">{selectedIds.length} selecionados</span>
                                        <span className="text-sm font-medium">Lançamentos prontos para ação em lote.</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setSelectedIds([])} className="text-indigo-200 hover:text-white px-3 py-1.5 text-xs font-bold transition-colors">Cancelar</button>
                                        <button
                                            onClick={handleCriarBordero}
                                            disabled={selectedIds.length < 2 || criarBorderoMutation.isPending}
                                            className="bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-1.5 rounded text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                        >
                                            {criarBorderoMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> : null}
                                            Agrupar em Borderô
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Lista de Movimentações */}
                            <div className="divide-y divide-gray-100">
                                {extratoData.itens.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        Nenhuma movimentação encontrada nesta fatura.
                                    </div>
                                ) : (
                                    extratoData.itens.map(item => {
                                        // RENDERIZAÇÃO DE LINHA NORMAL (idêntico ao ExtratoManager)
                                        const renderRowNormal = (l, isFilho = false) => (
                                            <div
                                                key={l.id}
                                                onClick={() => handleRowClick(l)}
                                                className={`p-4 cursor-pointer transition-colors flex items-center justify-between group 
                                                    ${selectedIds.includes(l.id) ? 'bg-indigo-50/50 hover:bg-indigo-50 border-l-4 border-l-indigo-400' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}
                                                    ${isFilho ? 'pl-12 bg-gray-50/50 border-t border-dashed' : ''}
                                                `}
                                            >
                                                {!isFilho && (
                                                    <div className="flex-shrink-0 pr-4 pl-1" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(l.id)}
                                                            onChange={(e) => toggleSelectRow(e, l.id)}
                                                            className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                                                        />
                                                    </div>
                                                )}
                                                {isFilho && <div className="flex-shrink-0 w-8 flex justify-center text-gray-300"><FontAwesomeIcon icon={faAngleRight} className="text-[10px]" /></div>}

                                                {/* Data */}
                                                <div className="flex-shrink-0 w-16 text-center">
                                                    <div className="text-sm font-bold text-gray-700">
                                                        {format(parseISO(l.data_transacao || l.data_vencimento), 'dd')}
                                                    </div>
                                                    <div className="text-[10px] uppercase font-semibold text-gray-400">
                                                        {format(parseISO(l.data_transacao || l.data_vencimento), 'MMM', { locale: ptBR })}
                                                    </div>
                                                </div>

                                                {/* Descrição */}
                                                <div className="flex-1 px-4 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <p className="text-sm font-bold truncate text-gray-800" title={l.descricao}>{l.descricao}</p>
                                                        {l.status_exibicao === 'Conciliado' && (
                                                            <span className="flex-shrink-0 text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                                <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />Conciliado
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 truncate">
                                                        {l.categoria?.nome || 'Sem Categoria'}{l.favorecido?.nome ? ` • ${l.favorecido.nome}` : ''}
                                                    </p>
                                                </div>

                                                {/* Valores */}
                                                <div className="flex-shrink-0 flex items-center gap-6 pr-4">
                                                    <div className="text-right min-w-[90px]">
                                                        {l.tipo === 'Receita' ? (
                                                            <p className="text-sm font-bold text-green-600">+{formatCurrency(l.entrada)}</p>
                                                        ) : (
                                                            <p className="text-sm font-bold text-gray-800">-{formatCurrency(l.saida)}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Ações */}
                                                <div className="flex-shrink-0 flex items-center gap-2 text-gray-300 group-hover:text-blue-500 transition-colors">
                                                    {isFilho ? (
                                                        <button onClick={(e) => handleRemoverDoBordero(e, l.id)} className="p-1.5 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-all" title="Desvincular do Borderô">
                                                            <p className="text-[10px] font-bold uppercase">Sair</p>
                                                        </button>
                                                    ) : (
                                                        hasPermission('financeiro', 'pode_excluir') && (
                                                            <button onClick={(e) => handleDelete(e, l)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all" title="Excluir Lançamento">
                                                                <FontAwesomeIcon icon={faTrash} size="sm" />
                                                            </button>
                                                        )
                                                    )}
                                                    <FontAwesomeIcon icon={faAngleRight} />
                                                </div>
                                            </div>
                                        );

                                        // RENDERIZAÇÃO DE BORDERÔ PAI (idêntico ao ExtratoManager)
                                        if (item.isBordero) {
                                            const isExpanded = expandedBorderos[item.id];
                                            return (
                                                <div key={item.id} className="flex flex-col">
                                                    <div
                                                        onClick={(e) => toggleBordero(e, item.id)}
                                                        className="p-4 cursor-pointer transition-colors flex items-center justify-between group hover:bg-indigo-50/30 border-l-4 border-l-indigo-600 bg-white"
                                                    >
                                                        <div className="flex-shrink-0 pr-4 pl-1 w-10 text-center">
                                                            <FontAwesomeIcon icon={faChevronRight} className={`text-indigo-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                                        </div>
                                                        <div className="flex-shrink-0 w-16 text-center">
                                                            <div className="text-sm font-bold text-indigo-900">
                                                                {format(parseISO(item.data_pagamento), 'dd')}
                                                            </div>
                                                            <div className="text-[10px] uppercase font-semibold text-indigo-400">
                                                                {format(parseISO(item.data_pagamento), 'MMM', { locale: ptBR })}
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 px-4 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <p className="text-sm font-extrabold truncate text-indigo-900">{item.descricao}</p>
                                                                {item.status_exibicao === 'Conciliado' && (
                                                                    <span className="flex-shrink-0 text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                                                        <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />Lote Ok
                                                                    </span>
                                                                )}
                                                                {item.status_exibicao === 'Parcial' && (
                                                                    <span className="flex-shrink-0 text-[8px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Baixa Parcial</span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-indigo-400 font-semibold truncate">Clique para ver as origens detalhadas</p>
                                                        </div>
                                                        <div className="flex-shrink-0 flex items-center gap-6 pr-4">
                                                            <div className="text-right min-w-[90px]">
                                                                {item.tipo === 'Receita' ? (
                                                                    <p className="text-sm font-bold text-green-600">+{formatCurrency(item.entrada)}</p>
                                                                ) : (
                                                                    <p className="text-sm font-black text-indigo-900">-{formatCurrency(item.saida)}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex-shrink-0 flex items-center gap-2 text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={(e) => handleDesagruparBordero(e, item.id)} className="px-2 py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded text-[10px] font-bold uppercase shadow-sm" title="Desfazer grupo">
                                                                Desagrupar
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {isExpanded && (
                                                        <div className="flex flex-col bg-gray-50/30">
                                                            {item.filhos.map(filho => renderRowNormal(filho, true))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return renderRowNormal(item);
                                    })
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* MODAL DE UPLOAD DE PDF (usa UppyFileImporter nativo do sistema) */}
            <UppyFileImporter
                isOpen={isUppyOpen}
                onClose={() => setIsUppyOpen(false)}
                onFileSelected={(files) => handlePdfUpload(files)}
                title="Importar Fatura PDF via IA"
                allowedFileTypes={['.pdf']}
                multiple={true}
                note="Selecione ou arraste 1 ou mais PDFs de faturas. A IA identifica automaticamente o cartão e o mês de cada fatura."
            />

            {/* SIDEBAR DE DETALHES (idêntico ao ExtratoManager) */}
            <LancamentoDetalhesSidebar
                open={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                lancamento={lancamentoSelecionado}
            />
        </div>
        </>
    );
}
