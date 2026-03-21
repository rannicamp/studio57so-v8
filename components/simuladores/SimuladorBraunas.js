// components/simuladores/SimuladorBraunas.js
// ============================================================
// Simulador Financeiro - Refúgio Braúnas
// Empreendimento fixado em id=6 (Refúgio Braúnas)
// Correção anual: max(0, INCC) + 11% sobre saldo devedor,
// distribuída pelas parcelas restantes no mês aniversário.
// ============================================================
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCalculator, faPrint, faExclamationTriangle, faInfoCircle, faPlus, faTrash, faTimes, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SimuladorPrintView from '@/components/SimuladorPrintView';
import { useLayout } from '@/contexts/LayoutContext';

// ─── Constantes ────────────────────────────────────────────────
const REFUGIO_BRAUNAS_ID = 6;
const REFUGIO_BRAUNAS_NOME = 'Refúgio Braúnas';

// ─── Componente de Telefone ────────────────────────────────────
const PhoneInput = ({ countryCode, onCountryChange, phone, onPhoneChange, placeholder }) => {
    const masks = { '+55': '(00) 00000-0000', '+1': '(000) 000-0000' };
    return (
        <div className="flex">
            <select value={countryCode} onChange={onCountryChange} className="p-2 border border-r-0 rounded-l-md bg-gray-50">
                <option value="+55">🇧🇷 +55</option>
                <option value="+1">🇺🇸 +1</option>
            </select>
            <IMaskInput mask={masks[countryCode]} value={phone} onAccept={onPhoneChange} placeholder={placeholder} className="p-2 border rounded-r-md w-full" />
        </div>
    );
};

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDateForDisplay = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

// ════════════════════════════════════════════════════════════════
export default function SimuladorBraunas() {
    const supabase = createClient();
    const { usuarioLogado } = useLayout();
    const empreendimentoFixo = { id: REFUGIO_BRAUNAS_ID, nome: REFUGIO_BRAUNAS_NOME };

    const [produtos, setProdutos] = useState([]);
    const [selectedProdutos, setSelectedProdutos] = useState([]);
    const [currentSelectedProdutoId, setCurrentSelectedProdutoId] = useState('');
    const [loadingProdutos, setLoadingProdutos] = useState(true);

    const [cliente, setCliente] = useState({ nome: '', telefone: '', country_code: '+55' });
    const [corretor, setCorretor] = useState({ nome: '', telefone: '', creci: '', country_code: '+55' });
    const [parcelasIntermediarias, setParcelasIntermediarias] = useState([]);

    useEffect(() => {
        if (usuarioLogado) {
            setCorretor(prev => ({
                ...prev,
                nome: usuarioLogado.nome || '',
                telefone: usuarioLogado.telefone || '',
                creci: usuarioLogado.creci || ''
            }));
        }
    }, [usuarioLogado]);

    const [plano, setPlano] = useState({
        valor_base: 0,
        desconto_percentual: 0,
        desconto_valor: 0,
        entrada_percentual: 0,
        entrada_valor: 0,
        num_parcelas_entrada: 1,
        data_primeira_parcela_entrada: new Date().toISOString().split('T')[0],
        parcelas_obra_percentual: 0,
        parcelas_obra_valor: 0,
        num_parcelas_obra: 1,
        data_primeira_parcela_obra: '',
        saldo_remanescente_valor: 0,
        num_parcelas_saldo: 1,
        data_primeira_parcela_saldo: '',
    });

    const [cronograma, setCronograma] = useState([]);
    const [isSimulating, setIsSimulating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // INCC acumulado 12M (correção anual do saldo devedor)
    const [indiceINCC, setIndiceINCC] = useState(null);
    const [isLoadingINCC, setIsLoadingINCC] = useState(true);
    useEffect(() => {
        fetch('/api/simulador/indice?indice=INCC')
            .then(r => r.json())
            .then(d => setIndiceINCC(d.taxa_acumulada_12m ?? 0))
            .catch(() => setIndiceINCC(0))
            .finally(() => setIsLoadingINCC(false));
    }, []);

    const printRef = useRef();
    const handlePrint = () => window.print();

    const addIntermediaria = () => setParcelasIntermediarias([...parcelasIntermediarias, { id: Date.now(), descricao: 'Intermediária', data_vencimento: '', valor_parcela: '' }]);
    const updateIntermediaria = (id, field, value) => setParcelasIntermediarias(parcelasIntermediarias.map(p => p.id === id ? { ...p, [field]: value } : p));
    const removeIntermediaria = (id) => setParcelasIntermediarias(parcelasIntermediarias.filter(p => p.id !== id));

    const addProduto = () => {
        const produtoToAdd = produtos.find(p => p.id == currentSelectedProdutoId);
        if (produtoToAdd && !selectedProdutos.some(p => p.id === produtoToAdd.id)) {
            setSelectedProdutos([...selectedProdutos, produtoToAdd]);
        }
        setCurrentSelectedProdutoId('');
    };
    const removeProduto = (id) => setSelectedProdutos(selectedProdutos.filter(p => p.id !== id));

    // Busca produtos do Refúgio Braúnas
    useEffect(() => {
        const fetchProdutos = async () => {
            setLoadingProdutos(true);
            const { data } = await supabase
                .from('produtos_empreendimento')
                .select('id, unidade, tipo, area_m2, valor_venda_calculado')
                .eq('empreendimento_id', REFUGIO_BRAUNAS_ID)
                .eq('status', 'Disponível')
                .order('unidade');
            setProdutos(data || []);
            setSelectedProdutos([]);
            setLoadingProdutos(false);
        };
        fetchProdutos();
    }, []);

    const totalValorBase = useMemo(() => selectedProdutos.reduce((acc, p) => acc + (parseFloat(p.valor_venda_calculado) || 0), 0), [selectedProdutos]);
    const totalIntermediarias = useMemo(() => parcelasIntermediarias.reduce((acc, p) => acc + (parseFloat(p.valor_parcela) || 0), 0), [parcelasIntermediarias]);

    useEffect(() => {
        const base = totalValorBase;
        const desc = parseFloat(plano.desconto_valor) || 0;
        const entr = parseFloat(plano.entrada_valor) || 0;
        const obra = parseFloat(plano.parcelas_obra_valor) || 0;
        const inter = totalIntermediarias;
        const saldo = base - desc - entr - obra - inter;
        setPlano(prev => ({ ...prev, valor_base: base, saldo_remanescente_valor: saldo > 0 ? saldo.toFixed(2) : '0.00' }));
        setCronograma([]);
    }, [totalValorBase, plano.desconto_valor, plano.entrada_valor, plano.parcelas_obra_valor, totalIntermediarias]);

    const handlePlanoChange = (name, value) => {
        const newPlanoState = { ...plano };
        const baseValue = totalValorBase;
        const numericValue = parseFloat(String(value).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
        if (name.includes('_percentual')) {
            const valueFieldName = name.replace('_percentual', '_valor');
            newPlanoState[name] = value;
            if (baseValue > 0) newPlanoState[valueFieldName] = ((numericValue / 100) * baseValue).toFixed(2);
        } else if (name.includes('_valor')) {
            const percentFieldName = name.replace('_valor', '_percentual');
            newPlanoState[name] = value;
            if (baseValue > 0 && name !== 'saldo_remanescente_valor') newPlanoState[percentFieldName] = parseFloat(((numericValue / baseValue) * 100).toFixed(4));
        } else {
            newPlanoState[name] = value;
        }
        setPlano(newPlanoState);
    };

    useEffect(() => {
        if (plano.data_primeira_parcela_obra && plano.num_parcelas_obra > 0) {
            const dataUltimaParcelaObra = new Date(plano.data_primeira_parcela_obra);
            dataUltimaParcelaObra.setUTCMonth(dataUltimaParcelaObra.getUTCMonth() + plano.num_parcelas_obra);
            setPlano(prev => ({ ...prev, data_primeira_parcela_saldo: dataUltimaParcelaObra.toISOString().split('T')[0] }));
        }
    }, [plano.data_primeira_parcela_obra, plano.num_parcelas_obra]);

    // Preenche a data da 1ª parcela automaticamente com +30 dias da entrada
    useEffect(() => {
        if (plano.data_primeira_parcela_entrada) {
            const d = new Date(plano.data_primeira_parcela_entrada + 'T00:00:00Z');
            d.setUTCDate(d.getUTCDate() + 30);
            setPlano(prev => ({ ...prev, data_primeira_parcela_obra: d.toISOString().split('T')[0] }));
        }
    }, [plano.data_primeira_parcela_entrada]);



    const valorFinal = totalValorBase - (parseFloat(plano.desconto_valor) || 0);
    const totalAlocado = (parseFloat(plano.entrada_valor) || 0) + (parseFloat(plano.parcelas_obra_valor) || 0) + totalIntermediarias + (parseFloat(plano.saldo_remanescente_valor) || 0);
    const diferencaTotal = valorFinal - totalAlocado;

    // ════════════════════════════════════════════════════════════
    // MOTOR DE SIMULAÇÃO COM CORREÇÃO ANUAL
    // Regra: taxa = max(0, IGP-M) + 11%
    // No mês aniversário: calcula sobre saldo devedor e distribui
    // o valor da correção pelas parcelas restantes.
    // ════════════════════════════════════════════════════════════
    const handleSimular = () => {
        setIsSimulating(true);
        let idCounter = 1;

        // Passo 1: Construir listas separadas
        const parcelasEntrada = [];
        const parcelasFinanciadas = [];

        if (plano.num_parcelas_entrada > 0 && plano.entrada_valor > 0) {
            const vp = plano.entrada_valor / plano.num_parcelas_entrada;
            for (let i = 0; i < plano.num_parcelas_entrada; i++) {
                const d = new Date(plano.data_primeira_parcela_entrada);
                d.setUTCMonth(d.getUTCMonth() + i);
                parcelasEntrada.push({ id: idCounter++, tipo: 'entrada', descricao: `Entrada ${i + 1}/${plano.num_parcelas_entrada}`, data_vencimento: d.toISOString().split('T')[0], valor_parcela: vp });
            }
        }

        if (plano.num_parcelas_obra > 0 && plano.parcelas_obra_valor > 0 && plano.data_primeira_parcela_obra) {
            const vp = plano.parcelas_obra_valor / plano.num_parcelas_obra;
            for (let i = 0; i < plano.num_parcelas_obra; i++) {
                const d = new Date(plano.data_primeira_parcela_obra);
                d.setUTCMonth(d.getUTCMonth() + i);
                parcelasFinanciadas.push({ id: idCounter++, tipo: 'obra', descricao: `Parcela ${i + 1}/${plano.num_parcelas_obra}`, data_vencimento: d.toISOString().split('T')[0], valor_parcela: vp });
            }
        }

        parcelasIntermediarias.forEach(p => {
            if (p.data_vencimento && p.valor_parcela > 0) {
                parcelasFinanciadas.push({ ...p, id: idCounter++, tipo: 'intermediaria' });
            }
        });

        if (plano.num_parcelas_saldo > 0 && plano.saldo_remanescente_valor > 0 && plano.data_primeira_parcela_saldo) {
            const vp = plano.saldo_remanescente_valor / plano.num_parcelas_saldo;
            for (let i = 0; i < plano.num_parcelas_saldo; i++) {
                const d = new Date(plano.data_primeira_parcela_saldo);
                d.setUTCMonth(d.getUTCMonth() + i);
                parcelasFinanciadas.push({ id: idCounter++, tipo: 'saldo', descricao: `Saldo Remanescente ${i + 1}/${plano.num_parcelas_saldo}`, data_vencimento: d.toISOString().split('T')[0], valor_parcela: vp });
            }
        }

        parcelasFinanciadas.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));

        // Passo 2: Aplicar Correção Anual (max(0, INCC) + 11%)
        const inccEfetivo = Math.max(0, indiceINCC ?? 0);
        const taxaAnual = inccEfetivo + 11; // % ao ano

        // Saldo devedor inicial = total financiado (excluindo entrada)
        let saldoDevedor = (parseFloat(plano.parcelas_obra_valor) || 0)
            + totalIntermediarias
            + (parseFloat(plano.saldo_remanescente_valor) || 0);

        for (let i = 0; i < parcelasFinanciadas.length; i++) {
            const mesContador = i + 1;
            parcelasFinanciadas[i].correcao_aplicada = 0;

            // Mês aniversário (12, 24, 36...): aplica correção
            if (mesContador % 12 === 0 && saldoDevedor > 0.01) {
                const totalCorrecao = saldoDevedor * (taxaAnual / 100);
                const restantes = parcelasFinanciadas.length - i; // inclui a parcela atual

                // Distribui a correção pelas parcelas restantes (incluindo a atual)
                const acrescimoPorParcela = totalCorrecao / restantes;
                for (let j = i; j < parcelasFinanciadas.length; j++) {
                    parcelasFinanciadas[j].valor_parcela += acrescimoPorParcela;
                }

                parcelasFinanciadas[i].correcao_aplicada = totalCorrecao;
                parcelasFinanciadas[i].taxa_aplicada = taxaAnual;
                // Saldo devedor cresce com a correção ANTES do pagamento
                saldoDevedor += totalCorrecao;
            }

            // Paga a parcela (valor já corrigido se for mês aniversário)
            saldoDevedor -= parcelasFinanciadas[i].valor_parcela;
            parcelasFinanciadas[i].saldo_devedor = Math.max(0, saldoDevedor);
        }

        // Passo 3: Montar cronograma final com saldo devedor global nas entradas
        let saldoGlobal = valorFinal;
        const entradaComSaldo = parcelasEntrada.map(p => {
            saldoGlobal -= p.valor_parcela;
            return { ...p, saldo_devedor: Math.max(0, saldoGlobal), correcao_aplicada: 0 };
        });

        const cronogramaFinal = [...entradaComSaldo, ...parcelasFinanciadas]
            .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));

        setCronograma(cronogramaFinal);
        setIsSimulating(false);
        const qtdCorrecoes = parcelasFinanciadas.filter(p => p.correcao_aplicada > 0).length;
        toast.success(`Simulação gerada! ${qtdCorrecoes} correção(ões) de ${taxaAnual.toFixed(2)}% a.a. (INCC ${inccEfetivo.toFixed(2)}% + 11%) aplicada(s).`);
    };

    const resumoData = useMemo(() => {
        if (selectedProdutos.length === 0) return null;
        const ultimaParcelaObra = new Date(plano.data_primeira_parcela_obra);
        if (plano.data_primeira_parcela_obra) {
            ultimaParcelaObra.setUTCMonth(ultimaParcelaObra.getUTCMonth() + (plano.num_parcelas_obra - 1));
        }
        return {
            valorBase: totalValorBase,
            descontoPercentual: parseFloat(plano.desconto_percentual) || 0,
            descontoValor: parseFloat(plano.desconto_valor) || 0,
            valorFinal: valorFinal,
            entradaPercentual: parseFloat(plano.entrada_percentual) || 0,
            entradaNumParcelas: plano.num_parcelas_entrada,
            entradaValorParcela: (parseFloat(plano.entrada_valor) || 0) / plano.num_parcelas_entrada,
            obraPercentual: parseFloat(plano.parcelas_obra_percentual) || 0,
            obraNumParcelas: plano.num_parcelas_obra,
            obraValorParcela: (parseFloat(plano.parcelas_obra_valor) || 0) / plano.num_parcelas_obra,
            totalIntermediarias: totalIntermediarias,
            saldoRemanescente: parseFloat(plano.saldo_remanescente_valor) || 0,
            saldoRemPercentual: (parseFloat(plano.saldo_remanescente_valor) / (valorFinal || 1)) * 100,
            mesAnoUltimaParcelaObra: plano.data_primeira_parcela_obra ? `${String(ultimaParcelaObra.getUTCMonth() + 1).padStart(2, '0')}/${ultimaParcelaObra.getUTCFullYear()}` : 'N/A'
        };
    }, [plano, selectedProdutos, totalValorBase, valorFinal, totalIntermediarias]);

    const handleEnviarProposta = async () => {
        if (!cliente.nome || !cliente.telefone) {
            toast.error("O nome e o telefone do cliente são obrigatórios para enviar a proposta.");
            return;
        }
        const simulacaoCompletaData = {
            empreendimento: empreendimentoFixo,
            produtos: selectedProdutos,
            plano: { ...plano, parcelas_intermediarias: parcelasIntermediarias },
            cronograma,
            valorFinal,
            resumo: resumoData,
            cliente,
            corretor,
            organizacao_id: 1,
        };
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/simulacao/enviar-proposta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ simulacaoData: simulacaoCompletaData }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Falha ao enviar proposta.");
            toast.success(result.message);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const printViewData = useMemo(() => {
        if (!resumoData || selectedProdutos.length === 0 || cronograma.length === 0) return null;
        const simulacaoParaImpressao = {
            id: `PROP-${Date.now()}`,
            valor_venda: resumoData.valorBase,
            desconto_valor: resumoData.descontoValor,
            desconto_percentual: resumoData.descontoPercentual.toFixed(2),
        };
        const planoPropostaParaImpressao = cronograma.map((p, index) => ({
            numero: index + 1,
            descricao: p.descricao,
            vencimento: format(new Date(p.data_vencimento + 'T00:00:00Z'), 'dd/MM/yyyy', { locale: ptBR }),
            valor: formatCurrency(p.valor_parcela),
            saldo_devedor: p.saldo_devedor !== undefined ? formatCurrency(p.saldo_devedor) : null,
            correcao_aplicada: p.correcao_aplicada || 0,
            correcao_texto: p.correcao_aplicada > 0 ? formatCurrency(p.correcao_aplicada) : null,
        }));

        return {
            simulacao: simulacaoParaImpressao,
            produto: selectedProdutos[0],
            empreendimento: empreendimentoFixo,
            contato: cliente,
            corretor: corretor,
            planoProposta: planoPropostaParaImpressao,
            resumo: resumoData,
        };
    }, [resumoData, selectedProdutos, cliente, corretor, cronograma]);

    // ════════════════════════════════════════════════════════════
    return (
        <div>
            <style jsx global>{`@media print {@page { size: A4 portrait; margin: 1cm; } html, body { height: initial !important; overflow: initial !important; -webkit-print-color-adjust: exact; } .printable-area { padding: 0 !important; margin: 0 !important; height: auto; } .no-print { display: none !important; }}`}</style>

            <div className="hidden print:block printable-area s57-print-area">
                <SimuladorPrintView
                    ref={printRef}
                    simulacao={printViewData?.simulacao}
                    produto={printViewData?.produto}
                    empreendimento={printViewData?.empreendimento}
                    contato={printViewData?.contato}
                    corretor={printViewData?.corretor}
                    planoProposta={printViewData?.planoProposta}
                    resumo={printViewData?.resumo}
                />
            </div>

            <div className="space-y-8 no-print">
                <h1 className="text-3xl font-bold text-center text-gray-800">Simulador — Refúgio Braúnas</h1>

                {/* Dados do Cliente e Corretor */}
                <fieldset className="p-4 border rounded-lg">
                    <legend className="px-2 font-semibold text-gray-700">Dados da Simulação</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <input type="text" placeholder="Nome do Cliente" value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} className="p-2 border rounded-md" />
                        <input type="text" placeholder="Nome do Corretor" value={corretor.nome} readOnly className="p-2 border rounded-md bg-gray-100 text-gray-600" />
                        <PhoneInput countryCode={cliente.country_code} onCountryChange={(e) => setCliente({ ...cliente, country_code: e.target.value, telefone: '' })} phone={cliente.telefone} onPhoneChange={(value) => setCliente({ ...cliente, telefone: value })} placeholder="Telefone do Cliente" />
                        <div className="flex gap-2">
                            <input type="text" readOnly placeholder="Telefone do Corretor" value={corretor.telefone} className="p-2 border rounded-md w-full bg-gray-100 text-gray-600" />
                            <input type="text" readOnly placeholder="CRECI" value={corretor.creci} className="p-2 border rounded-md w-full bg-gray-100 text-gray-600" />
                        </div>
                    </div>
                </fieldset>

                {/* Seleção do Lote */}
                <fieldset className="p-4 border rounded-lg">
                    <legend className="px-2 font-semibold text-gray-700">Passo 1: Selecione o Lote</legend>
                    <div className="mb-4 p-3 bg-blue-50 rounded-md flex items-center gap-3">
                        <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Empreendimento:</span>
                        <span className="font-bold text-blue-800">{REFUGIO_BRAUNAS_NOME}</span>
                        <span className="ml-auto text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase">Fixo</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={currentSelectedProdutoId} onChange={(e) => setCurrentSelectedProdutoId(e.target.value)} disabled={loadingProdutos} className="p-2 border rounded-md w-full">
                            <option value="">{loadingProdutos ? 'Carregando lotes...' : 'Selecione a Unidade/Lote'}</option>
                            {produtos.filter(p => !selectedProdutos.some(sp => sp.id === p.id)).map(p => (
                                <option key={p.id} value={p.id}>Lote {p.unidade} ({p.tipo}) — {parseFloat(p.area_m2).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m² — {formatCurrency(p.valor_venda_calculado)}</option>
                            ))}
                        </select>
                        <button onClick={addProduto} disabled={!currentSelectedProdutoId} className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300">
                            <FontAwesomeIcon icon={faPlus} />
                        </button>
                    </div>
                    {selectedProdutos.length > 0 && (
                        <div className="mt-4 p-3 border rounded-md bg-gray-50">
                            <h4 className="font-semibold text-gray-700 mb-2">Lotes Selecionados</h4>
                            <ul className="space-y-2">
                                {selectedProdutos.map(p => (
                                    <li key={p.id} className="flex justify-between items-center bg-white p-2 border rounded-md">
                                        <span>Lote {p.unidade} ({p.tipo}) — {parseFloat(p.area_m2).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m² — <strong>{formatCurrency(p.valor_venda_calculado)}</strong></span>
                                        <button onClick={() => removeProduto(p.id)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTimes} /></button>
                                    </li>
                                ))}
                            </ul>
                            <div className="text-right font-bold mt-3 text-lg">Valor Total: {formatCurrency(totalValorBase)}</div>
                        </div>
                    )}
                </fieldset>

                {/* Condições de Pagamento */}
                {selectedProdutos.length > 0 && (
                    <fieldset className="p-4 border rounded-lg">
                        <legend className="px-2 font-semibold text-gray-700">Passo 2: Defina as Condições</legend>
                        <div className="space-y-4">
                            {/* Desconto */}
                            <div className="p-3 border rounded-md bg-gray-50">
                                <h4 className="font-medium text-gray-600 mb-2">Desconto</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="text-sm">Desconto (%)</label><input type="number" step="0.01" value={plano.desconto_percentual || ''} onChange={e => handlePlanoChange('desconto_percentual', e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div><label className="text-sm">Desconto (R$)</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] } }} unmask={true} value={String(plano.desconto_valor || '')} onAccept={(value) => handlePlanoChange('desconto_valor', value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                                </div>
                            </div>
                            {/* Entrada */}
                            <div className="p-3 border rounded-md bg-gray-50">
                                <h4 className="font-medium text-gray-600 mb-2">Entrada</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div><label className="text-sm">Entrada (%)</label><input type="number" step="0.01" value={plano.entrada_percentual || ''} onChange={e => handlePlanoChange('entrada_percentual', e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div><label className="text-sm">Entrada (R$)</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] } }} unmask={true} value={String(plano.entrada_valor || '')} onAccept={(value) => handlePlanoChange('entrada_valor', value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div><label className="text-sm">Nº Parcelas</label><input type="number" min="1" value={plano.num_parcelas_entrada} onChange={e => handlePlanoChange('num_parcelas_entrada', parseInt(e.target.value))} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div><label className="text-sm">Data 1ª Parcela</label><input type="date" value={plano.data_primeira_parcela_entrada} onChange={e => handlePlanoChange('data_primeira_parcela_entrada', e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                                </div>
                            </div>
                        <div className="p-3 border rounded-md bg-gray-50">
                                <h4 className="font-medium text-gray-600 mb-2">Parcelas</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div><label className="text-sm">Parcelas (%)</label><input type="number" step="0.01" value={plano.parcelas_obra_percentual || ''} onChange={e => handlePlanoChange('parcelas_obra_percentual', e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div><label className="text-sm">Parcelas (R$)</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] } }} unmask={true} value={String(plano.parcelas_obra_valor || '')} onAccept={(value) => handlePlanoChange('parcelas_obra_valor', value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div><label className="text-sm">Nº Parcelas</label><input type="number" min="1" value={plano.num_parcelas_obra} onChange={e => handlePlanoChange('num_parcelas_obra', parseInt(e.target.value))} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div><label className="text-sm">Data 1ª Parcela</label><input type="date" value={plano.data_primeira_parcela_obra} onChange={e => handlePlanoChange('data_primeira_parcela_obra', e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                                </div>
                            </div>
                            {/* Parcelas Intermediárias */}
                            <div className="p-3 border rounded-md bg-gray-50">
                                <h4 className="font-medium text-gray-600 mb-2">Parcelas Intermediárias</h4>
                                <div className="space-y-2">
                                    {parcelasIntermediarias.map((p) => (
                                        <div key={p.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                                            <input type="text" placeholder="Descrição" value={p.descricao} onChange={(e) => updateIntermediaria(p.id, 'descricao', e.target.value)} className="p-2 border rounded-md md:col-span-2" />
                                            <input type="date" value={p.data_vencimento} onChange={(e) => updateIntermediaria(p.id, 'data_vencimento', e.target.value)} className="p-2 border rounded-md" />
                                            <div className="flex items-center gap-2">
                                                <IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] } }} unmask={true} value={String(p.valor_parcela || '')} onAccept={(value) => updateIntermediaria(p.id, 'valor_parcela', value)} className="w-full p-2 border rounded-md" />
                                                <button onClick={() => removeIntermediaria(p.id)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={addIntermediaria} type="button" className="text-sm text-blue-600 hover:text-blue-800 font-semibold mt-2 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faPlus} /> Adicionar Parcela Intermediária
                                </button>
                            </div>
                            {/* Saldo Remanescente */}
                            <div className="p-3 border rounded-md bg-gray-50">
                                <h4 className="font-medium text-gray-600 mb-2">Saldo Remanescente</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div><label className="text-sm">Valor Total (R$)</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] } }} unmask={true} value={String(plano.saldo_remanescente_valor || '')} onAccept={(value) => handlePlanoChange('saldo_remanescente_valor', value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div><label className="text-sm">Nº Parcelas</label><input type="number" min="1" value={plano.num_parcelas_saldo} onChange={e => handlePlanoChange('num_parcelas_saldo', parseInt(e.target.value))} className="mt-1 w-full p-2 border rounded-md" /></div>
                                    <div><label className="text-sm">Data 1ª Parcela</label><input type="date" value={plano.data_primeira_parcela_saldo} readOnly className="mt-1 w-full p-2 border rounded-md bg-gray-200" /></div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 pl-1 flex items-center gap-2"><FontAwesomeIcon icon={faInfoCircle} /> O Saldo Remanescente é comumente pago na entrega das chaves.</p>
                            </div>
                            {/* Alerta de diferença */}
                            {Math.abs(diferencaTotal) > 0.01 && (
                                <div className="p-3 bg-red-100 text-red-800 rounded-md flex items-center gap-3 text-sm font-semibold">
                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                    <span>A soma dos valores ({formatCurrency(totalAlocado)}) é diferente do Valor Final ({formatCurrency(valorFinal)}). Diferença de {formatCurrency(diferencaTotal)}.</span>
                                </div>
                            )}
                        </div>
                        <div className="text-center mt-6">
                            <button onClick={handleSimular} disabled={isSimulating || Math.abs(diferencaTotal) > 0.01} className="bg-blue-600 text-white font-bold px-8 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 mx-auto">
                                <FontAwesomeIcon icon={isSimulating ? faSpinner : faCalculator} spin={isSimulating} /> {isSimulating ? 'Calculando...' : 'Gerar Simulação'}
                            </button>
                        </div>
                    </fieldset>
                )}

                {/* Resultado */}
                {cronograma.length > 0 && (
                    <fieldset className="p-4 border rounded-lg">
                        <legend className="px-2 font-semibold text-gray-700">Passo 3: Resultado da Simulação</legend>

                        {resumoData && (
                            <div className="p-4 border rounded-md space-y-3 text-lg mb-6">
                                <div className="flex justify-between items-center"><span className="text-gray-600">Valor Base Total:</span><span className="font-bold text-blue-700">{formatCurrency(resumoData.valorBase)}</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-600">Desconto ({resumoData.descontoPercentual.toFixed(2)}%):</span><span className="font-bold text-red-600">{formatCurrency(resumoData.descontoValor)}</span></div>
                                <div className="flex justify-between items-center border-t pt-3 mt-3"><span className="font-semibold text-gray-800">Valor Final (c/ Desc.):</span><span className="font-bold text-green-700 text-xl">{formatCurrency(resumoData.valorFinal)}</span></div>
                                <hr className="my-4" />
                                <div className="flex justify-between items-center"><span className="text-gray-600">Entrada ({resumoData.entradaPercentual.toFixed(2)}%):</span><span className="font-semibold">{resumoData.entradaNumParcelas}x de {formatCurrency(resumoData.entradaValorParcela)}</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-600">Parcelas ({resumoData.obraPercentual.toFixed(2)}%):</span><span className="font-semibold">{resumoData.obraNumParcelas}x de {formatCurrency(resumoData.obraValorParcela)}</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-600">Intermediárias:</span><span className="font-semibold">{formatCurrency(resumoData.totalIntermediarias)}</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-600">Saldo Rem. ({resumoData.saldoRemPercentual.toFixed(2)}%):</span><span className="font-semibold">{formatCurrency(resumoData.saldoRemanescente)}</span></div>
                                <div className="flex justify-between items-center text-sm text-gray-500 border-t pt-2 mt-2"><span className="font-semibold">Mês/Ano Última Parc. Obra:</span><span>{resumoData.mesAnoUltimaParcelaObra}</span></div>
                            </div>
                        )}

                        {/* Cabeçalho da tabela com taxa */}
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-gray-800">Cronograma Detalhado</h4>
                            {!isLoadingINCC && indiceINCC !== null && (
                                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-bold">
                                    Correção Anual: INCC ({indiceINCC.toFixed(2)}%) + 11% = {(Math.max(0, indiceINCC) + 11).toFixed(2)}% a.a.
                                </span>
                            )}
                        </div>

                        {/* Tabela de 5 colunas */}
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-semibold">Descrição</th>
                                        <th className="px-4 py-2 text-left font-semibold">Vencimento</th>
                                        <th className="px-4 py-2 text-right font-semibold">Valor (R$)</th>
                                        <th className="px-4 py-2 text-right font-semibold">Saldo Devedor</th>
                                        <th className="px-4 py-2 text-right font-semibold">Correção Aplicada</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y">
                                    {cronograma.map(p => (
                                        <tr key={p.id} className={p.correcao_aplicada > 0 ? 'bg-amber-50' : ''}>
                                            <td className="px-4 py-2">
                                                {p.correcao_aplicada > 0 ? (
                                                    <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800">
                                                        <span className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0"></span>
                                                        {p.descricao}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-700">{p.descricao}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{formatDateForDisplay(p.data_vencimento)}</td>
                                            <td className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${p.correcao_aplicada > 0 ? 'text-amber-700' : 'text-gray-800'}`}>
                                                {formatCurrency(p.valor_parcela)}
                                            </td>
                                            <td className="px-4 py-2 text-right text-gray-500 whitespace-nowrap text-sm">
                                                {p.saldo_devedor !== undefined ? formatCurrency(p.saldo_devedor) : '—'}
                                            </td>
                                            <td className="px-4 py-2 text-right whitespace-nowrap">
                                                {p.correcao_aplicada > 0 ? (
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded">
                                                            + {formatCurrency(p.correcao_aplicada)}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">{p.taxa_aplicada?.toFixed(2)}% a.a.</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-200 text-xs">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-center items-center gap-4 mt-6">
                            <button onClick={handlePrint} className="bg-gray-700 text-white font-bold px-6 py-3 rounded-md hover:bg-gray-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={faPrint} /> Imprimir / PDF
                            </button>
                            <button onClick={handleEnviarProposta} disabled={isSubmitting} className="bg-green-600 text-white font-bold px-6 py-3 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2">
                                <FontAwesomeIcon icon={isSubmitting ? faSpinner : faPaperPlane} spin={isSubmitting} /> {isSubmitting ? 'Enviando...' : 'Enviar Proposta'}
                            </button>
                        </div>
                    </fieldset>
                )}
            </div>
        </div>
    );
}
