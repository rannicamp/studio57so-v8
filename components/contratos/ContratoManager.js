"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faFileSignature, faIdCard, faPrint, faSpinner, faWhatsapp, faPlus, faTrash, faSyncAlt, faSave, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import ContratoAnexos from './ContratoAnexos';

// --- Funções Auxiliares ---
const formatCurrency = (value) => {
    if (value == null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};
const parseISODate = (inputString) => {
    if (!inputString || !/^\d{4}-\d{2}-\d{2}$/.test(inputString)) return null;
    const date = new Date(`${inputString}T12:00:00Z`);
    return isNaN(date.getTime()) ? null : date;
};
const addMonths = (date, months) => {
    if (!(date instanceof Date) || isNaN(date.getTime()) || !isFinite(months)) return null;
    const d = new Date(date);
    const originalDay = d.getUTCDate();
    d.setUTCMonth(d.getUTCMonth() + months);
    const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(originalDay, daysInMonth));
    return d;
};
const formatFullDatePT = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '---';
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

// --- Componente de Permutas ---
const GestaoPermutas = ({ contratoId, onTotalPermutasChange }) => {
    const supabase = createClient();
    const [permutas, setPermutas] = useState([]);
    const [newPermuta, setNewPermuta] = useState({ descricao: '', valor: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchPermutas = async () => {
            const { data } = await supabase.from('contrato_permutas').select('*').eq('contrato_id', contratoId);
            setPermutas(data || []);
        };
        fetchPermutas();
    }, [contratoId, supabase]);
    
    useEffect(() => {
        const total = permutas.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0);
        onTotalPermutasChange(total);
    }, [permutas, onTotalPermutasChange]);

    const handleAdd = async () => {
        if (!newPermuta.descricao || !newPermuta.valor) {
            toast.error("Preencha a descrição e o valor da permuta.");
            return;
        }
        setLoading(true);
        const valorNumerico = parseFloat(String(newPermuta.valor).replace(/\./g, '').replace(',', '.')) || 0;
        const { data, error } = await supabase.from('contrato_permutas').insert({ contrato_id: contratoId, descricao: newPermuta.descricao, valor: valorNumerico }).select().single();
        if (error) { toast.error("Erro ao adicionar item: " + error.message);
        } else { setPermutas(prev => [...prev, data]); setNewPermuta({ descricao: '', valor: '' }); toast.success("Item de permuta adicionado!"); }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        const { error } = await supabase.from('contrato_permutas').delete().eq('id', id);
        if (error) { toast.error("Erro ao remover item: " + error.message);
        } else { setPermutas(prev => prev.filter(p => p.id !== id)); toast.success("Item de permuta removido."); }
    };

    return (
        <div className="bg-orange-50 p-6 rounded-lg border border-orange-200 space-y-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faSyncAlt} className="text-orange-500" /> Itens Recebidos em Permuta</h3>
            <div className="space-y-2">{permutas.length > 0 ? (permutas.map(item => (<div key={item.id} className="flex justify-between items-center bg-white p-2 rounded border"><span className="font-medium text-sm">{item.descricao}</span><div className="flex items-center gap-4"><span className="font-bold text-sm">{formatCurrency(item.valor)}</span><button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button></div></div>))) : <p className="text-sm text-gray-500 text-center py-4">Nenhum item de permuta adicionado.</p>}</div>
            <div className="flex items-end gap-3 pt-4 border-t">
                <div className="flex-grow"><label className="text-xs font-medium">Descrição</label><input type="text" value={newPermuta.descricao} onChange={(e) => setNewPermuta(p => ({...p, descricao: e.target.value}))} className="w-full p-2 border rounded-md" placeholder="Ex: Lote Bairro X" /></div>
                <div className="w-48"><label className="text-xs font-medium">Valor (R$)</label><input type="text" value={newPermuta.valor} onChange={(e) => setNewPermuta(p => ({...p, valor: e.target.value}))} className="w-full p-2 border rounded-md" placeholder="150.000,00" /></div>
                <button onClick={handleAdd} disabled={loading} className="bg-orange-500 text-white px-4 py-2 rounded-md h-fit"><FontAwesomeIcon icon={loading ? faSpinner : faPlus} spin={loading}/> Adicionar</button>
            </div>
        </div>
    );
};

// --- Componente do Simulador Financeiro ---
const SimuladorFinanceiro = ({ contrato, totalPermutas, onUpdate }) => {
    const [plano, setPlano] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const supabase = createClient();
    const [newAdditional, setNewAdditional] = useState({ valor: '', data_pagamento: '' });

    const fetchPlano = useCallback(async () => {
        setLoading(true);
        if (contrato.plano_pagamento) {
            setPlano(contrato.plano_pagamento);
        } else {
            const { data: defaultConfig } = await supabase.from('configuracoes_venda').select('*, parcelas_adicionais(*)').eq('empreendimento_id', contrato.empreendimento_id).maybeSingle();
            setPlano(defaultConfig || {
                desconto_percentual: 0, entrada_percentual: 20, parcelas_obra_percentual: 40,
                num_parcelas_entrada: 3, num_parcelas_obra: 36,
                data_primeira_parcela_entrada: addMonths(new Date(), 1).toISOString().split('T')[0],
                data_primeira_parcela_obra: addMonths(new Date(), 2).toISOString().split('T')[0],
                parcelas_adicionais: [],
            });
        }
        setLoading(false);
    }, [contrato, supabase]);
    
    useEffect(() => { fetchPlano(); }, [fetchPlano]);

    const handleSavePlano = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('contratos')
            .update({ plano_pagamento: plano })
            .eq('id', contrato.id);
        
        if (error) { toast.error("Erro ao salvar o plano: " + error.message);
        } else { toast.success("Plano de pagamento salvo neste contrato!"); onUpdate(); }
        setSaving(false);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setPlano(prev => ({ ...prev, [name]: value }));
    };
    
    const handleAddAdditional = () => {
        if (!newAdditional.valor || !newAdditional.data_pagamento) {
            toast.error("Preencha o valor e a data da parcela.");
            return;
        }
        const newParcela = {
            id: `temp-${Date.now()}`,
            valor: parseFloat(String(newAdditional.valor).replace(/\./g, '').replace(',', '.')) || 0,
            data_pagamento: newAdditional.data_pagamento
        };
        setPlano(prev => ({ ...prev, parcelas_adicionais: [...(prev.parcelas_adicionais || []), newParcela] }));
        setNewAdditional({ valor: '', data_pagamento: '' });
    };

    const handleDeleteAdditional = (id) => {
        setPlano(prev => ({ ...prev, parcelas_adicionais: prev.parcelas_adicionais.filter(p => p.id !== id) }));
    };

    const TabelaCalculada = useMemo(() => {
        if (!plano) return {};
        const valorVendaOriginal = parseFloat(contrato.valor_final_venda) || 0;
        const desconto = parseFloat(plano.desconto_percentual) || 0;
        const valorComDesconto = valorVendaOriginal * (1 - desconto / 100);
        const totalAdicionais = (plano.parcelas_adicionais || []).reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);
        const totalEntrada = valorComDesconto * ((parseFloat(plano.entrada_percentual) || 0) / 100);
        const totalObra = valorComDesconto * ((parseFloat(plano.parcelas_obra_percentual) || 0) / 100);
        const totalRemanescente = valorComDesconto - totalEntrada - totalObra - totalAdicionais - totalPermutas;
        const numParcelasEntrada = parseInt(plano.num_parcelas_entrada) || 1;
        const valorParcelaEntrada = numParcelasEntrada > 0 ? totalEntrada / numParcelasEntrada : 0;
        const numParcelasObra = parseInt(plano.num_parcelas_obra) || 1;
        const valorParcelaObra = numParcelasObra > 0 ? totalObra / numParcelasObra : 0;
        return { valorOriginal: valorVendaOriginal, valorComDesconto, totalEntrada, totalObra, totalRemanescente, numParcelasEntrada, valorParcelaEntrada, numParcelasObra, valorParcelaObra };
    }, [contrato, plano, totalPermutas]);
    
    const scheduleData = useMemo(() => {
        if (!plano || !TabelaCalculada) return [];
        const payments = [];
        if(totalPermutas > 0) payments.push({ date: new Date(), amount: totalPermutas, type: 'Permuta' });
        const entryDate = parseISODate(plano.data_primeira_parcela_entrada);
        const obraDate = parseISODate(plano.data_primeira_parcela_obra);
        if (entryDate) for (let i = 0; i < TabelaCalculada.numParcelasEntrada; i++) payments.push({ date: addMonths(entryDate, i), amount: TabelaCalculada.valorParcelaEntrada, type: 'Entrada' });
        if (obraDate) for (let i = 0; i < TabelaCalculada.numParcelasObra; i++) payments.push({ date: addMonths(obraDate, i), amount: TabelaCalculada.valorParcelaObra, type: 'Obra' });
        (plano.parcelas_adicionais || []).forEach(p => payments.push({ date: parseISODate(p.data_pagamento), amount: p.valor, type: 'Adicional' }));
        payments.sort((a, b) => a.date - b.date);
        let saldoDevedor = TabelaCalculada.valorComDesconto;
        return payments.map(p => { saldoDevedor -= p.amount; return { ...p, saldoDevedor }; });
    }, [plano, TabelaCalculada, totalPermutas]);

    if (loading) return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin /> Carregando simulador...</div>;

    return (
        <div className="bg-gray-50 p-6 rounded-lg border space-y-6">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faFileInvoiceDollar} />Plano de Pagamento</h3>
                <button onClick={handleSavePlano} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
                    <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
                    Salvar Plano neste Contrato
                </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div><label className="block text-sm font-medium">Desconto (%)</label><input type="number" name="desconto_percentual" value={plano.desconto_percentual || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div><label className="block text-sm font-medium">Entrada (%)</label><input type="number" name="entrada_percentual" value={plano.entrada_percentual || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                <div><label className="block text-sm font-medium">Nº Parcelas</label><input type="number" name="num_parcelas_entrada" value={plano.num_parcelas_entrada || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                <div className="col-span-2"><label className="block text-sm font-medium">Data 1ª Parcela</label><input type="date" name="data_primeira_parcela_entrada" value={plano.data_primeira_parcela_entrada || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                <div><label className="block text-sm font-medium">Obra (%)</label><input type="number" name="parcelas_obra_percentual" value={plano.parcelas_obra_percentual || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                <div><label className="block text-sm font-medium">Nº Parcelas</label><input type="number" name="num_parcelas_obra" value={plano.num_parcelas_obra || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                <div className="col-span-2"><label className="block text-sm font-medium">Data 1ª Parcela</label><input type="date" name="data_primeira_parcela_obra" value={plano.data_primeira_parcela_obra || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /></div>
            </div>
            <div className="pt-4 border-t">
                <h4 className="font-semibold text-gray-700 mb-2">Parcelas Adicionais / Intermediárias</h4>
                <div className="space-y-2">
                    {(plano.parcelas_adicionais || []).map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white p-2 rounded border">
                            <span className="font-medium text-sm">Valor: {formatCurrency(item.valor)}</span>
                            <div className="flex items-center gap-4"><span className="text-sm">Data: {formatFullDatePT(parseISODate(item.data_pagamento))}</span><button onClick={() => handleDeleteAdditional(item.id)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button></div>
                        </div>
                    ))}
                </div>
                <div className="flex items-end gap-3 pt-4 mt-2 border-t">
                    <div className="flex-grow"><label className="text-xs font-medium">Valor (R$)</label><input type="text" value={newAdditional.valor} onChange={(e) => setNewAdditional(p => ({...p, valor: e.target.value}))} className="w-full p-2 border rounded-md" placeholder="25.000,00" /></div>
                    <div className="flex-grow"><label className="text-xs font-medium">Data de Pagamento</label><input type="date" value={newAdditional.data_pagamento} onChange={(e) => setNewAdditional(p => ({...p, data_pagamento: e.target.value}))} className="w-full p-2 border rounded-md"/></div>
                    <button onClick={handleAddAdditional} className="bg-blue-500 text-white px-4 py-2 rounded-md h-fit"><FontAwesomeIcon icon={faPlus}/> Adicionar</button>
                </div>
            </div>
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                     <thead className="bg-gray-200">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-bold uppercase">Data</th>
                            <th className="px-4 py-2 text-left text-xs font-bold uppercase">Tipo</th>
                            <th className="px-4 py-2 text-right text-xs font-bold uppercase">Valor Parcela</th>
                            <th className="px-4 py-2 text-right text-xs font-bold uppercase">Saldo Devedor</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y">
                        <tr><td colSpan="3" className="px-4 py-2 font-bold text-right">Valor de Tabela:</td><td className="px-4 py-2 text-right font-bold">{formatCurrency(TabelaCalculada.valorOriginal)}</td></tr>
                        {plano.desconto_percentual > 0 && (<tr className="text-red-600"><td colSpan="3" className="px-4 py-2 font-bold text-right">Desconto ({plano.desconto_percentual}%):</td><td className="px-4 py-2 text-right font-bold">-{formatCurrency(TabelaCalculada.valorOriginal - TabelaCalculada.valorComDesconto)}</td></tr>)}
                        <tr className="bg-gray-100"><td colSpan="3" className="px-4 py-2 font-bold text-right">Valor Final da Venda:</td><td className="px-4 py-2 text-right font-bold">{formatCurrency(TabelaCalculada.valorComDesconto)}</td></tr>
                        {scheduleData.map((item, index) => (<tr key={index} className={item.type === 'Permuta' ? 'bg-orange-100' : ''}><td className="px-4 py-2">{formatFullDatePT(item.date)}</td><td className="px-4 py-2">{item.type}</td><td className="px-4 py-2 text-right text-red-600">-{formatCurrency(item.amount)}</td><td className="px-4 py-2 text-right">{formatCurrency(item.saldoDevedor)}</td></tr>))}
                         <tr className="bg-blue-100 font-bold text-blue-800"><td colSpan="3" className="px-4 py-2 text-right">Saldo Remanescente (Financiamento):</td><td className="px-4 py-2 text-right">{formatCurrency(TabelaCalculada.totalRemanescente)}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Componente Principal (Manager) ---
export default function ContratoManager({ initialContratoData }) {
    const [contrato, setContrato] = useState(initialContratoData);
    const [totalPermutas, setTotalPermutas] = useState(0);
    const supabase = createClient();

    const handleUpdateContrato = useCallback(async () => {
        const { data } = await supabase.from('contratos').select('*, contato:contato_id(*), produto:produto_id(*), empreendimento:empreendimento_id(nome)').eq('id', contrato.id).single();
        setContrato(data);
    }, [supabase, contrato.id]);

    const handleStatusChange = async (e) => {
        const newStatus = e.target.value;
        // Atualiza o estado local imediatamente para a UI responder
        setContrato(prev => ({ ...prev, status_contrato: newStatus }));

        // Salva a alteração no banco de dados
        const { error } = await supabase
            .from('contratos')
            .update({ status_contrato: newStatus })
            .eq('id', contrato.id);
        
        if (error) {
            toast.error("Erro ao atualizar status: " + error.message);
            // Reverte a mudança na UI em caso de erro
            setContrato(initialContratoData);
        } else {
            toast.success("Status do contrato atualizado!");
        }
    };

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow-md border">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Gestão de Contrato #{contrato.id}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div className="bg-gray-50 p-4 rounded-md">
                        <h4 className="font-bold text-gray-600 flex items-center gap-2 mb-2"><FontAwesomeIcon icon={faIdCard} /> CLIENTE</h4>
                        <p className="font-semibold text-gray-800">{contrato.contato.nome || contrato.contato.razao_social}</p>
                        <p className="text-gray-500">{contrato.contato.cpf || contrato.contato.cnpj}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-md">
                        <h4 className="font-bold text-gray-600 flex items-center gap-2 mb-2"><FontAwesomeIcon icon={faFileSignature} /> PRODUTO</h4>
                        <p className="font-semibold text-gray-800">Unidade {contrato.produto.unidade} ({contrato.produto.tipo})</p>
                        <p className="text-gray-500">{contrato.empreendimento.nome}</p>
                    </div>
                    <div>
                         <label className="block text-sm font-medium">Status do Contrato</label>
                         <select value={contrato.status_contrato} onChange={handleStatusChange} className="mt-1 w-full p-2 border rounded-md">
                            <option>Em assinatura</option>
                            <option>Ativo</option>
                            <option>Quitado</option>
                            <option>Cancelado</option>
                         </select>
                    </div>
                </div>
            </div>
            <SimuladorFinanceiro contrato={contrato} totalPermutas={totalPermutas} onUpdate={handleUpdateContrato} />
            <GestaoPermutas contratoId={contrato.id} onTotalPermutasChange={setTotalPermutas} />
            <ContratoAnexos contratoId={contrato.id} onUpdate={handleUpdateContrato} />
        </div>
    );
}