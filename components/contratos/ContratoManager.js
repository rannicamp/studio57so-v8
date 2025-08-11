"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faFileSignature, faIdCard, faPrint, faSpinner, faWhatsapp, faPlus, faTrash, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
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

// --- INÍCIO DA MODIFICAÇÃO: Novo Componente para Permutas ---
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
        const { data, error } = await supabase
            .from('contrato_permutas')
            .insert({
                contrato_id: contratoId,
                descricao: newPermuta.descricao,
                valor: parseFloat(newPermuta.valor.replace(/\./g, '').replace(',', '.')) || 0
            })
            .select()
            .single();
        if (error) {
            toast.error("Erro ao adicionar item: " + error.message);
        } else {
            setPermutas(prev => [...prev, data]);
            setNewPermuta({ descricao: '', valor: '' });
            toast.success("Item de permuta adicionado!");
        }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        const { error } = await supabase.from('contrato_permutas').delete().eq('id', id);
        if (error) {
            toast.error("Erro ao remover item: " + error.message);
        } else {
            setPermutas(prev => prev.filter(p => p.id !== id));
            toast.success("Item de permuta removido.");
        }
    };

    return (
        <div className="bg-orange-50 p-6 rounded-lg border border-orange-200 space-y-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faSyncAlt} className="text-orange-500" />
                Itens Recebidos em Permuta
            </h3>
            <div className="space-y-2">
                {permutas.length > 0 ? (
                    permutas.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white p-2 rounded border">
                            <span className="font-medium text-sm">{item.descricao}</span>
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-sm">{formatCurrency(item.valor)}</span>
                                <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700">
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : <p className="text-sm text-gray-500 text-center py-4">Nenhum item de permuta adicionado.</p>}
            </div>
            <div className="flex items-end gap-3 pt-4 border-t">
                <div className="flex-grow"><label className="text-xs font-medium">Descrição do Item</label><input type="text" value={newPermuta.descricao} onChange={(e) => setNewPermuta(p => ({...p, descricao: e.target.value}))} className="w-full p-2 border rounded-md" placeholder="Ex: Lote Bairro X" /></div>
                <div className="w-48"><label className="text-xs font-medium">Valor (R$)</label><input type="text" value={newPermuta.valor} onChange={(e) => setNewPermuta(p => ({...p, valor: e.target.value}))} className="w-full p-2 border rounded-md" placeholder="150.000,00" /></div>
                <button onClick={handleAdd} disabled={loading} className="bg-orange-500 text-white px-4 py-2 rounded-md h-fit"><FontAwesomeIcon icon={loading ? faSpinner : faPlus} spin={loading}/> Adicionar</button>
            </div>
        </div>
    );
};
// --- FIM DA MODIFICAÇÃO ---

const SimuladorFinanceiro = ({ contrato, totalPermutas }) => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchConfig = async () => {
            setLoading(true);
            const { data } = await supabase.from('configuracoes_venda').select('*, parcelas_adicionais(*)').eq('empreendimento_id', contrato.empreendimento_id).maybeSingle();
            setConfig(data || { desconto_percentual: 0, entrada_percentual: 20, parcelas_obra_percentual: 40, num_parcelas_entrada: 3, num_parcelas_obra: 36, data_primeira_parcela_entrada: addMonths(new Date(), 1).toISOString().split('T')[0], data_primeira_parcela_obra: addMonths(new Date(), 2).toISOString().split('T')[0], parcelas_adicionais: [] });
            setLoading(false);
        };
        fetchConfig();
    }, [contrato.empreendimento_id, supabase]);

    const TabelaCalculada = useMemo(() => {
        if (!config) return {};
        const valorVenda = parseFloat(contrato.valor_final_venda) || 0;
        const totalAdicionais = (config.parcelas_adicionais || []).reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);
        
        // --- INÍCIO DA MODIFICAÇÃO ---
        // O Saldo Remanescente agora considera o valor da permuta
        const totalEntrada = valorVenda * ((parseFloat(config.entrada_percentual) || 0) / 100);
        const totalObra = valorVenda * ((parseFloat(config.parcelas_obra_percentual) || 0) / 100);
        const totalRemanescente = valorVenda - totalEntrada - totalObra - totalAdicionais - totalPermutas;
        // --- FIM DA MODIFICAÇÃO ---
        
        const numParcelasEntrada = parseInt(config.num_parcelas_entrada) || 1;
        const valorParcelaEntrada = numParcelasEntrada > 0 ? totalEntrada / numParcelasEntrada : 0;
        const numParcelasObra = parseInt(config.num_parcelas_obra) || 1;
        const valorParcelaObra = numParcelasObra > 0 ? totalObra / numParcelasObra : 0;

        return { valorComDesconto: valorVenda, totalEntrada, totalObra, totalRemanescente, numParcelasEntrada, valorParcelaEntrada, numParcelasObra, valorParcelaObra };
    }, [contrato, config, totalPermutas]);
    
    if (loading) return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin /> Carregando simulador...</div>;

    return (
        <div className="bg-gray-50 p-6 rounded-lg border space-y-6">
             <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faFileInvoiceDollar} />
                Resumo Financeiro
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="p-3 bg-white border rounded">
                    <p className="font-semibold text-gray-500">Valor da Venda</p>
                    <p className="font-bold text-lg">{formatCurrency(TabelaCalculada.valorComDesconto)}</p>
                </div>
                 <div className="p-3 bg-white border rounded">
                    <p className="font-semibold text-gray-500">Total Entrada</p>
                    <p className="font-bold text-lg">{formatCurrency(TabelaCalculada.totalEntrada)}</p>
                </div>
                <div className="p-3 bg-white border rounded">
                    <p className="font-semibold text-gray-500">Total Período de Obra</p>
                    <p className="font-bold text-lg">{formatCurrency(TabelaCalculada.totalObra)}</p>
                </div>
                <div className={`p-3 bg-white border rounded ${totalPermutas > 0 ? 'border-orange-300' : ''}`}>
                    <p className="font-semibold text-gray-500">Total Permuta</p>
                    <p className="font-bold text-lg text-orange-600">{formatCurrency(totalPermutas)}</p>
                </div>
                 <div className="col-span-full p-3 bg-white border-2 border-blue-500 rounded text-center">
                    <p className="font-semibold text-gray-600 uppercase">Saldo Remanescente (Financiamento)</p>
                    <p className="font-bold text-2xl text-blue-600">{formatCurrency(TabelaCalculada.totalRemanescente)}</p>
                </div>
            </div>
        </div>
    );
};


export default function ContratoManager({ initialContratoData }) {
    const [contrato, setContrato] = useState(initialContratoData);
    const supabase = createClient();
    // --- INÍCIO DA MODIFICAÇÃO ---
    const [totalPermutas, setTotalPermutas] = useState(0); // Novo estado para o total da permuta
    // --- FIM DA MODIFICAÇÃO ---

    const handleUpdateContrato = useCallback(async () => {
        const { data } = await supabase.from('contratos').select('*, contato:contato_id(*), produto:produto_id(*), empreendimento:empreendimento_id(nome)').eq('id', contrato.id).single();
        setContrato(data);
    }, [supabase, contrato.id]);

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
                         <select value={contrato.status_contrato} className="mt-1 w-full p-2 border rounded-md">
                            <option>Em assinatura</option>
                            <option>Ativo</option>
                            <option>Quitado</option>
                            <option>Cancelado</option>
                         </select>
                    </div>
                </div>
            </div>

            {/* --- INÍCIO DA MODIFICAÇÃO: Passando o total para o simulador --- */}
            <SimuladorFinanceiro contrato={contrato} totalPermutas={totalPermutas} />
            <GestaoPermutas contratoId={contrato.id} onTotalPermutasChange={setTotalPermutas} />
            {/* --- FIM DA MODIFICAÇÃO --- */}

            <ContratoAnexos contratoId={contrato.id} onUpdate={handleUpdateContrato} />
        </div>
    );
}