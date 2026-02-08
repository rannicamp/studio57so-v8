// components/SimuladorFinanceiroPublico.js
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCalculator, faPrint, faExclamationTriangle, faInfoCircle, faPlus, faTrash, faTimes, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import SimuladorPrintView from './SimuladorPrintView';

// --- Componente de Telefone com Seletor de País ---
const PhoneInput = ({ countryCode, onCountryChange, phone, onPhoneChange, placeholder }) => {
    const masks = {
        '+55': '(00) 00000-0000',
        '+1': '(000) 000-0000',
    };

    return (
        <div className="flex">
            <select
                value={countryCode}
                onChange={onCountryChange}
                className="p-2 border border-r-0 rounded-l-md bg-gray-50"
            >
                <option value="+55">🇧🇷 +55</option>
                <option value="+1">🇺🇸 +1</option>
            </select>
            <IMaskInput
                mask={masks[countryCode]}
                value={phone}
                onAccept={onPhoneChange}
                placeholder={placeholder}
                className="p-2 border rounded-r-md w-full"
            />
        </div>
    );
};

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDateForDisplay = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

export default function SimuladorFinanceiroPublico({ empreendimentos }) {
    const supabase = createClient();
    
    const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState('');
    const [produtos, setProdutos] = useState([]);
    const [selectedProdutos, setSelectedProdutos] = useState([]);
    const [currentSelectedProdutoId, setCurrentSelectedProdutoId] = useState('');
    const [loadingProdutos, setLoadingProdutos] = useState(false);
    
    const [cliente, setCliente] = useState({ nome: '', telefone: '', country_code: '+55' });
    const [corretor, setCorretor] = useState({ nome: '', telefone: '', country_code: '+55' });
    
    const [parcelasIntermediarias, setParcelasIntermediarias] = useState([]);

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

    useEffect(() => {
        const fetchProdutos = async () => {
            if (!selectedEmpreendimentoId) {
                setProdutos([]);
                setSelectedProdutos([]);
                return;
            }
            setLoadingProdutos(true);
            const { data } = await supabase.from('produtos_empreendimento').select('id, unidade, tipo, area_m2, valor_venda_calculado').eq('empreendimento_id', selectedEmpreendimentoId).eq('status', 'Disponível').order('unidade');
            setProdutos(data || []);
            setSelectedProdutos([]);
            setLoadingProdutos(false);
        };
        fetchProdutos();
    }, [selectedEmpreendimentoId, supabase]);
    
    const totalValorBase = useMemo(() => selectedProdutos.reduce((acc, p) => acc + (parseFloat(p.valor_venda_calculado) || 0), 0), [selectedProdutos]);
    const totalIntermediarias = useMemo(() => parcelasIntermediarias.reduce((acc, p) => acc + (parseFloat(p.valor_parcela) || 0), 0), [parcelasIntermediarias]);

    useEffect(() => {
        const base = totalValorBase;
        const desc = parseFloat(plano.desconto_valor) || 0;
        const entr = parseFloat(plano.entrada_valor) || 0;
        const obra = parseFloat(plano.parcelas_obra_valor) || 0;
        const inter = totalIntermediarias;
        const saldo = base - desc - entr - obra - inter;
        
        setPlano(prev => ({ 
            ...prev, 
            valor_base: base,
            saldo_remanescente_valor: saldo > 0 ? saldo.toFixed(2) : '0.00'
        }));
        
        setCronograma([]);
    }, [totalValorBase, plano.desconto_valor, plano.entrada_valor, plano.parcelas_obra_valor, totalIntermediarias]);

    const handlePlanoChange = (name, value) => {
        const newPlanoState = { ...plano };
        const baseValue = totalValorBase;
        const numericValue = parseFloat(String(value).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;

        if (name.includes('_percentual')) {
            const valueFieldName = name.replace('_percentual', '_valor');
            newPlanoState[name] = value;
            if (baseValue > 0) {
                const calculatedValue = (numericValue / 100) * baseValue;
                newPlanoState[valueFieldName] = calculatedValue.toFixed(2);
            }
        } else if (name.includes('_valor')) {
            const percentFieldName = name.replace('_valor', '_percentual');
            newPlanoState[name] = value;
            if (baseValue > 0 && name !== 'saldo_remanescente_valor') {
                const calculatedPercent = (numericValue / baseValue) * 100;
                newPlanoState[percentFieldName] = parseFloat(calculatedPercent.toFixed(4));
            }
        } else {
            newPlanoState[name] = value;
        }
        
        setPlano(newPlanoState);
    };
    
    useEffect(() => {
        if (plano.data_primeira_parcela_obra && plano.num_parcelas_obra > 0) {
            const dataUltimaParcelaObra = new Date(plano.data_primeira_parcela_obra);
            dataUltimaParcelaObra.setUTCMonth(dataUltimaParcelaObra.getUTCMonth() + plano.num_parcelas_obra);
            setPlano(prev => ({...prev, data_primeira_parcela_saldo: dataUltimaParcelaObra.toISOString().split('T')[0]}));
        }
    }, [plano.data_primeira_parcela_obra, plano.num_parcelas_obra]);

    const valorFinal = totalValorBase - (parseFloat(plano.desconto_valor) || 0);
    const totalAlocado = (parseFloat(plano.entrada_valor) || 0) + (parseFloat(plano.parcelas_obra_valor) || 0) + totalIntermediarias + (parseFloat(plano.saldo_remanescente_valor) || 0);
    const diferencaTotal = valorFinal - totalAlocado;
    
    const handleSimular = () => {
        setIsSimulating(true);
        let novasParcelas = [];
        let idCounter = 1;

        if (plano.num_parcelas_entrada > 0 && plano.entrada_valor > 0) {
            const valorParcelaEntrada = plano.entrada_valor / plano.num_parcelas_entrada;
            for (let i = 0; i < plano.num_parcelas_entrada; i++) {
                const dataVencimento = new Date(plano.data_primeira_parcela_entrada);
                dataVencimento.setUTCMonth(dataVencimento.getUTCMonth() + i);
                novasParcelas.push({ id: idCounter++, descricao: `Entrada ${i + 1}/${plano.num_parcelas_entrada}`, data_vencimento: dataVencimento.toISOString().split('T')[0], valor_parcela: valorParcelaEntrada });
            }
        }
        
        if (plano.num_parcelas_obra > 0 && plano.parcelas_obra_valor > 0 && plano.data_primeira_parcela_obra) {
            const valorParcelaObra = plano.parcelas_obra_valor / plano.num_parcelas_obra;
            for (let i = 0; i < plano.num_parcelas_obra; i++) {
                const dataVencimento = new Date(plano.data_primeira_parcela_obra);
                dataVencimento.setUTCMonth(dataVencimento.getUTCMonth() + i);
                novasParcelas.push({ id: idCounter++, descricao: `Parcela Obra ${i + 1}/${plano.num_parcelas_obra}`, data_vencimento: dataVencimento.toISOString().split('T')[0], valor_parcela: valorParcelaObra });
            }
        }
        
        parcelasIntermediarias.forEach(p => {
            if(p.data_vencimento && p.valor_parcela > 0) {
                novasParcelas.push({ ...p, id: idCounter++ });
            }
        });

        if (plano.num_parcelas_saldo > 0 && plano.saldo_remanescente_valor > 0 && plano.data_primeira_parcela_saldo) {
            const valorParcelaSaldo = plano.saldo_remanescente_valor / plano.num_parcelas_saldo;
            for (let i = 0; i < plano.num_parcelas_saldo; i++) {
                const dataVencimento = new Date(plano.data_primeira_parcela_saldo);
                dataVencimento.setUTCMonth(dataVencimento.getUTCMonth() + i);
                novasParcelas.push({ id: idCounter++, descricao: `Saldo Remanescente ${i + 1}/${plano.num_parcelas_saldo}`, data_vencimento: dataVencimento.toISOString().split('T')[0], valor_parcela: valorParcelaSaldo });
            }
        }

        novasParcelas.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
        setCronograma(novasParcelas);
        setIsSimulating(false);
        toast.success("Simulação gerada com sucesso!");
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
        }
    }, [plano, selectedProdutos, totalValorBase, valorFinal, totalIntermediarias]);
    
    // =================================================================================
    // ATUALIZAÇÃO DE SEGURANÇA (organização_id no envio)
    // O PORQUÊ: Buscamos o empreendimento selecionado para pegar sua `organizacao_id`.
    // Esse ID é enviado junto com os dados da simulação para a API, garantindo
    // que o lead seja criado e associado à organização correta no backend.
    // =================================================================================
    const handleEnviarProposta = async () => {
        if (!cliente.nome || !cliente.telefone) {
            toast.error("O nome e o telefone do cliente são obrigatórios para enviar a proposta.");
            return;
        }

        const empreendimentoSelecionado = empreendimentos.find(e => e.id == selectedEmpreendimentoId);
        if (!empreendimentoSelecionado || !empreendimentoSelecionado.organizacao_id) {
            toast.error("Erro de configuração: A organização do empreendimento não foi encontrada.");
            return;
        }

        const simulacaoCompletaData = {
            empreendimento: empreendimentoSelecionado,
            produtos: selectedProdutos,
            plano: { ...plano, parcelas_intermediarias: parcelasIntermediarias },
            cronograma,
            valorFinal,
            resumo: resumoData,
            cliente,
            corretor,
            organizacao_id: empreendimentoSelecionado.organizacao_id, // <-- A ETIQUETA DE SEGURANÇA!
        };

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/simulacao/enviar-proposta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ simulacaoData: simulacaoCompletaData }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Falha ao enviar proposta.");
            }

            toast.success(result.message);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const printViewData = useMemo(() => {
        if (!resumoData || selectedProdutos.length === 0 || cronograma.length === 0) {
            return null;
        }

        const simulacaoParaImpressao = {
            id: `PROP-${Date.now()}`,
            valor_venda: resumoData.valorBase,
            desconto_valor: resumoData.descontoValor,
            desconto_percentual: resumoData.descontoPercentual.toFixed(2),
        };

        const planoPropostaParaImpressao = cronograma.map((p, index) => ({
            numero: index + 1,
            descricao: p.descricao,
            vencimento: format(new Date(p.data_vencimento), 'dd/MM/yyyy', { locale: ptBR }),
            valor: formatCurrency(p.valor_parcela)
        }));

        return {
            simulacao: simulacaoParaImpressao,
            produto: selectedProdutos[0], 
            empreendimento: empreendimentos.find(e => e.id == selectedEmpreendimentoId),
            contato: cliente, 
            corretor: corretor,
            planoProposta: planoPropostaParaImpressao,
            resumo: resumoData,
        };

    }, [resumoData, selectedProdutos, empreendimentos, selectedEmpreendimentoId, cliente, corretor, cronograma]);

    return (
        <div>
            <style jsx global>{`@media print {@page { size: A4 portrait; margin: 1cm; } html, body { height: initial !important; overflow: initial !important; -webkit-print-color-adjust: exact; } body * { visibility: hidden; } .printable-area, .printable-area * { visibility: visible; } .printable-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; height: auto; } .no-print { display: none !important; } tfoot { display: table-row-group; }}`}</style>
            
            <div className="hidden print:block printable-area">
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
                <h1 className="text-3xl font-bold text-center text-gray-800">Simulador de Pagamentos</h1>
                
                <fieldset className="p-4 border rounded-lg"><legend className="px-2 font-semibold text-gray-700">Dados da Simulação</legend><div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"><input type="text" placeholder="Nome do Cliente" value={cliente.nome} onChange={(e) => setCliente({...cliente, nome: e.target.value})} className="p-2 border rounded-md" /><input type="text" placeholder="Nome do Corretor" value={corretor.nome} onChange={(e) => setCorretor({...corretor, nome: e.target.value})} className="p-2 border rounded-md" /><PhoneInput countryCode={cliente.country_code} onCountryChange={(e) => setCliente({...cliente, country_code: e.target.value, telefone: ''})} phone={cliente.telefone} onPhoneChange={(value) => setCliente({...cliente, telefone: value})} placeholder="Telefone do Cliente" /><PhoneInput countryCode={corretor.country_code} onCountryChange={(e) => setCorretor({...corretor, country_code: e.target.value, telefone: ''})} phone={corretor.telefone} onPhoneChange={(value) => setCorretor({...corretor, telefone: value})} placeholder="Telefone do Corretor" /></div></fieldset>
                
                <fieldset className="p-4 border rounded-lg">
                    <legend className="px-2 font-semibold text-gray-700">Passo 1: Selecione o Imóvel</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <select value={selectedEmpreendimentoId} onChange={(e) => setSelectedEmpreendimentoId(e.target.value)} className="p-2 border rounded-md w-full">
                            <option value="">Selecione o Empreendimento</option>
                            {empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                        </select>
                        <div className="flex items-center gap-2">
                             <select value={currentSelectedProdutoId} onChange={(e) => setCurrentSelectedProdutoId(e.target.value)} disabled={!selectedEmpreendimentoId || loadingProdutos} className="p-2 border rounded-md w-full">
                                 <option value="">{loadingProdutos ? 'Carregando...' : 'Selecione a Unidade'}</option>
                                 {produtos.filter(p => !selectedProdutos.some(sp => sp.id === p.id)).map(p => <option key={p.id} value={p.id}>{p.unidade} ({p.tipo}) - {formatCurrency(p.valor_venda_calculado)}</option>)}
                            </select>
                            <button onClick={addProduto} disabled={!currentSelectedProdutoId} className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300">
                                <FontAwesomeIcon icon={faPlus} />
                            </button>
                        </div>
                    </div>
                     {selectedProdutos.length > 0 && (
                        <div className="mt-4 p-3 border rounded-md bg-gray-50">
                            <h4 className="font-semibold text-gray-700 mb-2">Unidades Selecionadas</h4>
                            <ul className="space-y-2">
                                {selectedProdutos.map(p => (
                                    <li key={p.id} className="flex justify-between items-center bg-white p-2 border rounded-md">
                                        <span>{p.unidade} ({p.tipo}) - <strong>{formatCurrency(p.valor_venda_calculado)}</strong></span>
                                        <button onClick={() => removeProduto(p.id)} className="text-red-500 hover:text-red-700">
                                            <FontAwesomeIcon icon={faTimes} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <div className="text-right font-bold mt-3 text-lg">
                                Valor Total: {formatCurrency(totalValorBase)}
                            </div>
                        </div>
                    )}
                </fieldset>

                {selectedProdutos.length > 0 && (
                    <fieldset className="p-4 border rounded-lg animate-fade-in"><legend className="px-2 font-semibold text-gray-700">Passo 2: Defina as Condições</legend>
                        <div className="space-y-4">
                            <div className="p-3 border rounded-md bg-gray-50"><h4 className="font-medium text-gray-600 mb-2">Desconto</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-sm">Desconto (%)</label><input type="number" step="0.01" value={plano.desconto_percentual || ''} onChange={e => handlePlanoChange('desconto_percentual', e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div><div><label className="text-sm">Desconto (R$)</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(plano.desconto_valor || '')} onAccept={(value) => handlePlanoChange('desconto_valor', value)} className="mt-1 w-full p-2 border rounded-md" /></div></div></div>
                            <div className="p-3 border rounded-md bg-gray-50"><h4 className="font-medium text-gray-600 mb-2">Entrada</h4><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><div><label className="text-sm">Entrada (%)</label><input type="number" step="0.01" value={plano.entrada_percentual || ''} onChange={e => handlePlanoChange('entrada_percentual', e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div><div><label className="text-sm">Entrada (R$)</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(plano.entrada_valor || '')} onAccept={(value) => handlePlanoChange('entrada_valor', value)} className="mt-1 w-full p-2 border rounded-md" /></div><div><label className="text-sm">Nº Parcelas</label><input type="number" min="1" value={plano.num_parcelas_entrada} onChange={e => handlePlanoChange('num_parcelas_entrada', parseInt(e.target.value))} className="mt-1 w-full p-2 border rounded-md" /></div><div><label className="text-sm">Data 1ª Parcela</label><input type="date" value={plano.data_primeira_parcela_entrada} onChange={e => handlePlanoChange('data_primeira_parcela_entrada', e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div></div></div>
                            <div className="p-3 border rounded-md bg-gray-50"><h4 className="font-medium text-gray-600 mb-2">Parcelas Obra</h4><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><div><label className="text-sm">Obra (%)</label><input type="number" step="0.01" value={plano.parcelas_obra_percentual || ''} onChange={e => handlePlanoChange('parcelas_obra_percentual', e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div><div><label className="text-sm">Obra (R$)</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(plano.parcelas_obra_valor || '')} onAccept={(value) => handlePlanoChange('parcelas_obra_valor', value)} className="mt-1 w-full p-2 border rounded-md" /></div><div><label className="text-sm">Nº Parcelas</label><input type="number" min="1" value={plano.num_parcelas_obra} onChange={e => handlePlanoChange('num_parcelas_obra', parseInt(e.target.value))} className="mt-1 w-full p-2 border rounded-md" /></div><div><label className="text-sm">Data 1ª Parcela</label><input type="date" value={plano.data_primeira_parcela_obra} onChange={e => handlePlanoChange('data_primeira_parcela_obra', e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div></div></div>

                            <div className="p-3 border rounded-md bg-gray-50"><h4 className="font-medium text-gray-600 mb-2">Parcelas Intermediárias</h4><div className="space-y-2">{parcelasIntermediarias.map((p) => (<div key={p.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center"><input type="text" placeholder="Descrição" value={p.descricao} onChange={(e) => updateIntermediaria(p.id, 'descricao', e.target.value)} className="p-2 border rounded-md md:col-span-2" /><input type="date" value={p.data_vencimento} onChange={(e) => updateIntermediaria(p.id, 'data_vencimento', e.target.value)} className="p-2 border rounded-md" /><div className="flex items-center gap-2"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(p.valor_parcela || '')} onAccept={(value) => updateIntermediaria(p.id, 'valor_parcela', value)} className="w-full p-2 border rounded-md" /><button onClick={() => removeIntermediaria(p.id)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button></div></div>))}</div><button onClick={addIntermediaria} type="button" className="text-sm text-blue-600 hover:text-blue-800 font-semibold mt-2 flex items-center gap-2"><FontAwesomeIcon icon={faPlus} /> Adicionar Parcela Intermediária</button></div>

                            <div className="p-3 border rounded-md bg-gray-50"><h4 className="font-medium text-gray-600 mb-2">Saldo Remanescente</h4><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label className="text-sm">Valor Total (R$)</label><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(plano.saldo_remanescente_valor || '')} onAccept={(value) => handlePlanoChange('saldo_remanescente_valor', value)} className="mt-1 w-full p-2 border rounded-md" /></div><div><label className="text-sm">Nº Parcelas</label><input type="number" min="1" value={plano.num_parcelas_saldo} onChange={e => handlePlanoChange('num_parcelas_saldo', parseInt(e.target.value))} className="mt-1 w-full p-2 border rounded-md" /></div><div><label className="text-sm">Data 1ª Parcela</label><input type="date" value={plano.data_primeira_parcela_saldo} readOnly className="mt-1 w-full p-2 border rounded-md bg-gray-200" /></div></div><p className="text-xs text-gray-500 mt-2 pl-1 flex items-center gap-2"><FontAwesomeIcon icon={faInfoCircle} /> O Saldo Remanescente é comumente pago na entrega das chaves.</p></div>
                            
                            {Math.abs(diferencaTotal) > 0.01 && (<div className="p-3 bg-red-100 text-red-800 rounded-md flex items-center gap-3 text-sm font-semibold"><FontAwesomeIcon icon={faExclamationTriangle} /><span>A soma dos valores ({formatCurrency(totalAlocado)}) é diferente do Valor Final ({formatCurrency(valorFinal)}). Diferença de {formatCurrency(diferencaTotal)}.</span></div>)}
                        </div>
                        <div className="text-center mt-6"><button onClick={handleSimular} disabled={isSimulating || Math.abs(diferencaTotal) > 0.01} className="bg-blue-600 text-white font-bold px-8 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 mx-auto"><FontAwesomeIcon icon={isSimulating ? faSpinner : faCalculator} spin={isSimulating} /> {isSimulating ? 'Calculando...' : 'Gerar Simulação'}</button></div>
                    </fieldset>
                )}

                {cronograma.length > 0 && (
                        <fieldset className="p-4 border rounded-lg animate-fade-in"><legend className="px-2 font-semibold text-gray-700">Passo 3: Resultado da Simulação</legend>
                            {resumoData && <div className="p-4 border rounded-md space-y-3 text-lg mb-6"><div className="flex justify-between items-center"><span className="text-gray-600">Valor Base Total:</span><span className="font-bold text-blue-700">{formatCurrency(resumoData.valorBase)}</span></div><div className="flex justify-between items-center"><span className="text-gray-600">Desconto ({resumoData.descontoPercentual.toFixed(2)}%):</span><span className="font-bold text-red-600">{formatCurrency(resumoData.descontoValor)}</span></div><div className="flex justify-between items-center border-t pt-3 mt-3"><span className="font-semibold text-gray-800">Valor Final (c/ Desc.):</span><span className="font-bold text-green-700 text-xl">{formatCurrency(resumoData.valorFinal)}</span></div><hr className="my-4"/><div className="flex justify-between items-center"><span className="text-gray-600">Entrada ({resumoData.entradaPercentual.toFixed(2)}%):</span><span className="font-semibold">{resumoData.entradaNumParcelas}x de {formatCurrency(resumoData.entradaValorParcela)}</span></div><div className="flex justify-between items-center"><span className="text-gray-600">Parcelas Obra ({resumoData.obraPercentual.toFixed(2)}%):</span><span className="font-semibold">{resumoData.obraNumParcelas}x de {formatCurrency(resumoData.obraValorParcela)}</span></div><div className="flex justify-between items-center"><span className="text-gray-600">Intermediárias:</span><span className="font-semibold">{formatCurrency(resumoData.totalIntermediarias)}</span></div><div className="flex justify-between items-center"><span className="text-gray-600">Saldo Rem. ({resumoData.saldoRemPercentual.toFixed(2)}%):</span><span className="font-semibold">{formatCurrency(resumoData.saldoRemanescente)}</span></div><div className="flex justify-between items-center text-sm text-gray-500 border-t pt-2 mt-2"><span className="font-semibold">Mês/Ano Última Parc. Obra:</span><span>{resumoData.mesAnoUltimaParcelaObra}</span></div></div>}
                            <h4 className="font-semibold text-gray-800 mb-2 text-center">Cronograma Detalhado</h4>
                            <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm"><thead className="bg-gray-100"><tr><th className="px-4 py-2 text-left font-semibold">Descrição</th><th className="px-4 py-2 text-left font-semibold">Vencimento</th><th className="px-4 py-2 text-right font-semibold">Valor (R$)</th></tr></thead><tbody className="bg-white divide-y">{cronograma.map(p => (<tr key={p.id}><td className="px-4 py-2">{p.descricao}</td><td className="px-4 py-2">{formatDateForDisplay(p.data_vencimento)}</td><td className="px-4 py-2 text-right font-medium">{formatCurrency(p.valor_parcela)}</td></tr>))}</tbody></table></div>
                            <div className="flex justify-center items-center gap-4 mt-6">
                                <button onClick={handlePrint} className="bg-gray-700 text-white font-bold px-6 py-3 rounded-md hover:bg-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faPrint} /> Imprimir / PDF</button>
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