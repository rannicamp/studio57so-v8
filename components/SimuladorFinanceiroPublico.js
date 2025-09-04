// components/SimuladorFinanceiroPublico.js
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCalculator, faPrint, faExclamationTriangle, faInfoCircle, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

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
    const [selectedProduto, setSelectedProduto] = useState(null);
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
    
    const printRef = useRef();
    const handlePrint = () => window.print();

    const addIntermediaria = () => {
        setParcelasIntermediarias([...parcelasIntermediarias, { id: Date.now(), descricao: 'Intermediária', data_vencimento: '', valor_parcela: '' }]);
    };
    const updateIntermediaria = (id, field, value) => {
        setParcelasIntermediarias(parcelasIntermediarias.map(p => p.id === id ? { ...p, [field]: value } : p));
    };
    const removeIntermediaria = (id) => {
        setParcelasIntermediarias(parcelasIntermediarias.filter(p => p.id !== id));
    };

    useEffect(() => {
        const fetchProdutos = async () => {
            if (!selectedEmpreendimentoId) {
                setProdutos([]);
                setSelectedProduto(null);
                return;
            }
            setLoadingProdutos(true);
            const { data } = await supabase.from('produtos_empreendimento').select('id, unidade, tipo, valor_venda_calculado').eq('empreendimento_id', selectedEmpreendimentoId).eq('status', 'Disponível').order('unidade');
            setProdutos(data || []);
            setSelectedProduto(null);
            setLoadingProdutos(false);
        };
        fetchProdutos();
    }, [selectedEmpreendimentoId, supabase]);
    
    // ***** LÓGICA DE CÁLCULO CENTRALIZADA E CORRIGIDA *****
    const totalIntermediarias = useMemo(() => parcelasIntermediarias.reduce((acc, p) => acc + (parseFloat(p.valor_parcela) || 0), 0), [parcelasIntermediarias]);

    useEffect(() => {
        if (selectedProduto) {
            const base = parseFloat(selectedProduto.valor_venda_calculado) || 0;
            const desc = parseFloat(plano.desconto_valor) || 0;
            const entr = parseFloat(plano.entrada_valor) || 0;
            const obra = parseFloat(plano.parcelas_obra_valor) || 0;
            const inter = totalIntermediarias;
            const saldo = base - desc - entr - obra - inter;
            
            setPlano(prev => ({ 
                ...prev, 
                valor_base: base,
                saldo_remanescente_valor: saldo.toFixed(2) 
            }));
        } else {
            setPlano(prev => ({ ...prev, valor_base: 0, saldo_remanescente_valor: 0 }));
        }
        setCronograma([]);
    }, [selectedProduto, plano.desconto_valor, plano.entrada_valor, plano.parcelas_obra_valor, totalIntermediarias]);


    const handlePlanoChange = (name, value) => {
        const newPlanoState = { ...plano };
        const baseValue = parseFloat(newPlanoState.valor_base) || 0;
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

    const valorFinal = (parseFloat(plano.valor_base) || 0) - (parseFloat(plano.desconto_valor) || 0);
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
        if (!selectedProduto) return null;
        
        const ultimaParcelaObra = new Date(plano.data_primeira_parcela_obra);
        if (plano.data_primeira_parcela_obra) {
            ultimaParcelaObra.setUTCMonth(ultimaParcelaObra.getUTCMonth() + (plano.num_parcelas_obra - 1));
        }

        return {
            valorBase: parseFloat(plano.valor_base) || 0,
            descontoPercentual: parseFloat(plano.desconto_percentual) || 0,
            descontoValor: parseFloat(plano.desconto_valor) || 0,
            valorFinal: valorFinal,
            entradaPercentual: parseFloat(plano.entrada_percentual) || 0,
            entradaNumParcelas: plano.num_parcelas_entrada,
            entradaValorParcela: (parseFloat(plano.entrada_valor) || 0) / plano.num_parcelas_entrada,
            obraPercentual: parseFloat(plano.parcelas_obra_percentual) || 0,
            obraNumParcelas: plano.num_parcelas_obra,
            obraValorParcela: (parseFloat(plano.parcelas_obra_valor) || 0) / plano.num_parcelas_obra,
            saldoRemanescente: parseFloat(plano.saldo_remanescente_valor) || 0,
            saldoRemPercentual: ((parseFloat(plano.saldo_remanescente_valor) || 0) / (parseFloat(plano.valor_base) || 1)) * 100,
            mesAnoUltimaParcelaObra: plano.data_primeira_parcela_obra ? `${String(ultimaParcelaObra.getUTCMonth() + 1).padStart(2, '0')}/${ultimaParcelaObra.getUTCFullYear()}` : 'N/A'
        }
    }, [plano, selectedProduto, valorFinal]);

    const simulacaoCompletaData = {
        empreendimento: empreendimentos.find(e => e.id == selectedEmpreendimentoId),
        produto: selectedProduto,
        plano,
        cronograma,
        valorFinal,
        resumo: resumoData,
        cliente,
        corretor,
    };
    
    return (
        <div>
            <style jsx global>{`@media print {@page { size: A4 portrait; margin: 1cm; } html, body { height: initial !important; overflow: initial !important; -webkit-print-color-adjust: exact; } body * { visibility: hidden; } .printable-area, .printable-area * { visibility: visible; } .printable-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; height: auto; } .no-print { display: none !important; } tfoot { display: table-row-group; }}`}</style>
            <div className="hidden print:block printable-area">
                <SimuladorPrintView ref={printRef} simulacaoData={simulacaoCompletaData} />
            </div>

            <div className="space-y-8 no-print">
                <h1 className="text-3xl font-bold text-center text-gray-800">Simulador de Pagamentos</h1>
                
                <fieldset className="p-4 border rounded-lg"><legend className="px-2 font-semibold text-gray-700">Dados da Simulação</legend><div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"><input type="text" placeholder="Nome do Cliente" value={cliente.nome} onChange={(e) => setCliente({...cliente, nome: e.target.value})} className="p-2 border rounded-md" /><input type="text" placeholder="Nome do Corretor" value={corretor.nome} onChange={(e) => setCorretor({...corretor, nome: e.target.value})} className="p-2 border rounded-md" /><PhoneInput countryCode={cliente.country_code} onCountryChange={(e) => setCliente({...cliente, country_code: e.target.value, telefone: ''})} phone={cliente.telefone} onPhoneChange={(value) => setCliente({...cliente, telefone: value})} placeholder="Telefone do Cliente" /><PhoneInput countryCode={corretor.country_code} onCountryChange={(e) => setCorretor({...corretor, country_code: e.target.value, telefone: ''})} phone={corretor.telefone} onPhoneChange={(value) => setCorretor({...corretor, telefone: value})} placeholder="Telefone do Corretor" /></div></fieldset>
                <fieldset className="p-4 border rounded-lg"><legend className="px-2 font-semibold text-gray-700">Passo 1: Selecione o Imóvel</legend><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><select value={selectedEmpreendimentoId} onChange={(e) => setSelectedEmpreendimentoId(e.target.value)} className="p-2 border rounded-md w-full"><option value="">Selecione o Empreendimento</option>{empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select><select value={selectedProduto?.id || ''} onChange={(e) => setSelectedProduto(produtos.find(p => p.id == e.target.value) || null)} disabled={!selectedEmpreendimentoId || loadingProdutos} className="p-2 border rounded-md w-full"><option value="">{loadingProdutos ? 'Carregando...' : 'Selecione a Unidade'}</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.unidade} ({p.tipo}) - {formatCurrency(p.valor_venda_calculado)}</option>)}</select></div></fieldset>
                
                {selectedProduto && (
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
                        {resumoData && <div className="p-4 border rounded-md space-y-3 text-lg mb-6"><div className="flex justify-between items-center"><span className="text-gray-600">Valor Base Total:</span><span className="font-bold text-blue-700">{formatCurrency(resumoData.valorBase)}</span></div><div className="flex justify-between items-center"><span className="text-gray-600">Desconto ({resumoData.descontoPercentual.toFixed(2)}%):</span><span className="font-bold text-red-600">{formatCurrency(resumoData.descontoValor)}</span></div><div className="flex justify-between items-center border-t pt-3 mt-3"><span className="font-semibold text-gray-800">Valor Final (c/ Desc.):</span><span className="font-bold text-green-700 text-xl">{formatCurrency(resumoData.valorFinal)}</span></div><hr className="my-4"/><div className="flex justify-between items-center"><span className="text-gray-600">Entrada ({resumoData.entradaPercentual.toFixed(2)}%):</span><span className="font-semibold">{resumoData.entradaNumParcelas}x de {formatCurrency(resumoData.entradaValorParcela)}</span></div><div className="flex justify-between items-center"><span className="text-gray-600">Parcelas Obra ({resumoData.obraPercentual.toFixed(2)}%):</span><span className="font-semibold">{resumoData.obraNumParcelas}x de {formatCurrency(resumoData.obraValorParcela)}</span></div><div className="flex justify-between items-center"><span className="text-gray-600">Saldo Rem. ({resumoData.saldoRemPercentual.toFixed(2)}%):</span><span className="font-semibold">{formatCurrency(resumoData.saldoRemanescente)}</span></div><div className="flex justify-between items-center text-sm text-gray-500 border-t pt-2 mt-2"><span className="font-semibold">Mês/Ano Última Parc. Obra:</span><span>{resumoData.mesAnoUltimaParcelaObra}</span></div></div>}
                        <h4 className="font-semibold text-gray-800 mb-2 text-center">Cronograma Detalhado</h4>
                        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm"><thead className="bg-gray-100"><tr><th className="px-4 py-2 text-left font-semibold">Descrição</th><th className="px-4 py-2 text-left font-semibold">Vencimento</th><th className="px-4 py-2 text-right font-semibold">Valor (R$)</th></tr></thead><tbody className="bg-white divide-y">{cronograma.map(p => (<tr key={p.id}><td className="px-4 py-2">{p.descricao}</td><td className="px-4 py-2">{formatDateForDisplay(p.data_vencimento)}</td><td className="px-4 py-2 text-right font-medium">{formatCurrency(p.valor_parcela)}</td></tr>))}</tbody></table></div>
                        <div className="text-center mt-6"><button onClick={handlePrint} className="bg-gray-700 text-white font-bold px-8 py-3 rounded-md hover:bg-gray-800 flex items-center gap-2 mx-auto"><FontAwesomeIcon icon={faPrint} /> Imprimir / Salvar PDF</button></div>
                     </fieldset>
                )}
            </div>
        </div>
    );
}