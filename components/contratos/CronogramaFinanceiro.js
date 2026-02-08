//components\contratos\CronogramaFinanceiro.js
"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faSave, faFileInvoiceDollar, faExclamationTriangle, faPen, faTimes, faCopy, faExchangeAlt, faLink, faPrint } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import PlanoPagamentoPrint from './PlanoPagamentoPrint';
import { useAuth } from '../../contexts/AuthContext';

// --- FUNÇÕES DE FORMATAÇÃO E ESTILO (Inalteradas) ---
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDateForInput = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toISOString().split('T')[0] : '';

const formatDateForDisplay = (dateStr) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'N/A';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

const getParcelaStatus = (parcela) => {
    if (parcela.status_pagamento === 'Pago') {
        return { text: 'Paga', className: 'bg-green-100 text-green-800' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(parcela.data_vencimento + 'T00:00:00Z');
    
    if (dueDate < today) {
        return { text: 'Atrasada', className: 'bg-red-100 text-red-800' };
    }
    return { text: 'A Pagar', className: 'bg-yellow-100 text-yellow-800' };
};

export default function CronogramaFinanceiro({ contrato, onUpdate }) {
    const { id: contratoId, contrato_parcelas: parcelas, contrato_permutas: permutas, valor_final_venda: valorTotalContrato } = contrato;
    
    const supabase = createClient();
    const { user, userData } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [localParcelas, setLocalParcelas] = useState(parcelas || []);
    const [localPermutas, setLocalPermutas] = useState(permutas || []);
    const [newParcela, setNewParcela] = useState({ descricao: '', tipo: 'Adicional', data_vencimento: '', valor_parcela: '' });
    const [editingParcelaId, setEditingParcelaId] = useState(null);
    const [editingParcelaData, setEditingParcelaData] = useState({});
    const [newPermuta, setNewPermuta] = useState({ descricao: '', valor_permutado: '', data_registro: new Date().toISOString().split('T')[0] });
    const [loading, setLoading] = useState(false);
    const [isProvisioning, setIsProvisioning] = useState(false);
    const [proprietarios, setProprietarios] = useState([]);
    const [selectedSignatoryId, setSelectedSignatoryId] = useState('');
    const [geradoPor, setGeradoPor] = useState('');
    const isUserProprietario = userData?.funcoes?.nome_funcao === 'Proprietário';

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!organizacaoId) return;
            const { data: proprietariosData } = await supabase.from('usuarios').select('id, nome, sobrenome, funcionario:funcionarios(cpf), funcoes!inner(nome_funcao)').eq('organizacao_id', organizacaoId).eq('funcoes.nome_funcao', 'Proprietário');
            setProprietarios(proprietariosData || []);
            if (isUserProprietario && user) setSelectedSignatoryId(user.id);
            else if (proprietariosData?.length > 0) setSelectedSignatoryId(proprietariosData[0].id);
            if (userData) setGeradoPor(`${userData.nome} ${userData.sobrenome}`);
        };
        fetchInitialData();
    }, [supabase, user, userData, isUserProprietario, organizacaoId]);
    
    const selectedSignatory = useMemo(() => {
        if (!selectedSignatoryId || proprietarios.length === 0) return null;
        const signatory = proprietarios.find(p => p.id === selectedSignatoryId);
        return signatory ? { name: `${signatory.nome || ''} ${signatory.sobrenome || ''}`.trim(), cpf: signatory.funcionario?.cpf || 'N/A' } : null;
    }, [selectedSignatoryId, proprietarios]);

    useEffect(() => { setLocalParcelas(parcelas || []); setLocalPermutas(permutas || []); }, [parcelas, permutas]);

    // =================================================================================
    // LÓGICA "INTELIGENTE" (Inalterada)
    // =================================================================================
    const { 
        parcelasNormais,
        parcelasOrdenadas,
        totalParcelasNormais, // Soma de Entrada, Obra, Adicionais, etc.
        totalPermutas,
        displaySaldoRemanescente, // O objeto Saldo Remanescente com valor CALCULADO
        diferencaDeSincronia // O alerta que mostra se o valor do banco está desatualizado
    } = useMemo(() => {
        const pNormais = (localParcelas || []).filter(p => 
            p.tipo !== 'Saldo Remanescente' && 
            !p.descricao?.toLowerCase().includes('saldo remanescente')
        );
        
        const pSaldoOriginal = (localParcelas || []).find(p => 
            p.tipo === 'Saldo Remanescente' || 
            p.descricao?.toLowerCase().includes('saldo remanescente')
        );

        const pOrdenadas = [...pNormais].sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
        
        const tParcelasNormais = pNormais.reduce((sum, p) => sum + parseFloat(p.valor_parcela || 0), 0);
        const tPermutas = (localPermutas || []).reduce((sum, p) => sum + parseFloat(p.valor_permutado || 0), 0);
        
        // MÁGICA: O valor "inteligente" do saldo remanescente é calculado
        const valorCalculadoSaldo = parseFloat(valorTotalContrato || 0) - tParcelasNormais - tPermutas;
        
        let dSaldo = {
            id: pSaldoOriginal?.id || 'calculado',
            descricao: pSaldoOriginal?.descricao || 'Saldo Remanescente (Chaves)',
            data_vencimento: pSaldoOriginal?.data_vencimento || '', // Preserva a data
            tipo: pSaldoOriginal?.tipo || 'Saldo Remanescente',
            valor_parcela: valorCalculadoSaldo // Sobrescreve o valor do banco!
        };

        // A "DIFERENÇA" (Verificação) agora é o quanto o valor calculado difere do valor salvo no banco.
        const valorOriginalSaldo = parseFloat(pSaldoOriginal?.valor_parcela || 0);
        const tDiferenca = valorCalculadoSaldo - valorOriginalSaldo;

        return {
            parcelasNormais: pNormais,
            parcelasOrdenadas: pOrdenadas,
            totalParcelasNormais: tParcelasNormais,
            totalPermutas: tPermutas,
            displaySaldoRemanescente: dSaldo,
            diferencaDeSincronia: tDiferenca // O alerta (diferença real do banco)
        };
        
    }, [localParcelas, localPermutas, valorTotalContrato]);
    // =================================================================================
    // FIM DA LÓGICA
    // =================================================================================

    const hasPendingParcelsToProvision = useMemo(() => localParcelas.some(p => !p.lancamento_id && p.status_pagamento === 'Pendente'), [localParcelas]);
    
    // --- LÓGICA DE PROVISIONAMENTO (Inalterada) ---
    const handleProvisionarLancamentos = async () => {
        setIsProvisioning(true);
        const promise = supabase.rpc('provisionar_parcelas_contrato', { p_contrato_id: contratoId, p_organizacao_id: organizacaoId });
        toast.promise(promise, {
            loading: 'Provisionando lançamentos...',
            success: (rpcResult) => {
                onUpdate();
                if (rpcResult.error) throw new Error(rpcResult.error.message);
                const responseMessage = rpcResult.data;
                if (typeof responseMessage !== 'string') { console.error("Resposta inesperada:", responseMessage); throw new Error("Erro inesperado."); }
                if (responseMessage.startsWith('Erro:')) throw new Error(responseMessage);
                if (responseMessage.startsWith('Nenhuma')) toast.info(responseMessage);
                return responseMessage;
            },
            error: (err) => `Falha: ${err.message.replace(/^Error:\s*/, '')}`,
            finally: () => setIsProvisioning(false)
        });
    };

    // --- LÓGICA DE PARCELAS (Inalterada) ---
    const handleAddParcela = async () => {
        if (!newParcela.descricao || !newParcela.data_vencimento || !newParcela.valor_parcela) return toast.error("Preencha todos os campos.");
        if (!organizacaoId) return toast.error("Organização não identificada.");
        setLoading(true);
        const valorNumerico = parseFloat(newParcela.valor_parcela) || 0;
        const { data: insertedData, error: insertError } = await supabase.from('contrato_parcelas').insert({ contrato_id: contratoId, ...newParcela, valor_parcela: valorNumerico, organizacao_id: organizacaoId }).select().single();
        if (insertError) { toast.error("Erro: " + insertError.message); setLoading(false); return; }
        toast.success("Parcela adicionada!");
        const { error: syncError } = await supabase.rpc('sincronizar_parcela_com_lancamento', { p_parcela_id: insertedData.id, p_organizacao_id: organizacaoId });
        if (syncError) toast.warning("Erro ao criar lançamento: " + syncError.message); else toast.success("Lançamento criado!");
        setNewParcela({ descricao: '', tipo: 'Adicional', data_vencimento: '', valor_parcela: '' });
        onUpdate(); setLoading(false);
    };

    const handleSaveEditingParcela = async (parcelaId) => {
        setLoading(true);
        const { id, ...updateData } = editingParcelaData;
        updateData.valor_parcela = parseFloat(String(updateData.valor_parcela || '')) || 0;
        const { error: updateError } = await supabase.from('contrato_parcelas').update(updateData).eq('id', parcelaId);
        if (updateError) { toast.error("Erro: " + updateError.message); setLoading(false); return; }
        toast.success("Parcela atualizada!");
        const { error: syncError } = await supabase.rpc('sincronizar_parcela_com_lancamento', { p_parcela_id: parcelaId, p_organizacao_id: organizacaoId });
        if (syncError) toast.warning("Erro ao sincronizar: " + syncError.message); else toast.success("Lançamento atualizado!");
        setEditingParcelaId(null); onUpdate(); setLoading(false);
    };
    
    const handleDeleteParcela = (parcelaId) => {
        toast("Confirmar Exclusão", {
            description: "O lançamento financeiro vinculado também será excluído.",
            action: { label: "Excluir", onClick: () => {
                setLoading(true);
                const promise = supabase.rpc('excluir_parcela_e_lancamento', { p_parcela_id: parcelaId, p_organizacao_id: organizacaoId });
                toast.promise(promise, { loading: 'Excluindo...', success: () => { onUpdate(); return "Parcela excluída."; }, error: (err) => `Erro: ${err.message}`, finally: () => setLoading(false) });
            }},
            cancel: { label: "Cancelar" }, classNames: { actionButton: 'bg-red-600' }
        });
    };
    
    const handleDuplicateParcela = (parcelaId) => {
        toast("Confirmar Duplicação", {
            description: "Deseja criar uma cópia desta parcela?",
            action: { label: "Duplicar", onClick: () => {
                const promise = new Promise(async (resolve, reject) => {
                    const { data, error } = await supabase.rpc('duplicar_parcela_contrato', { p_parcela_id: parcelaId, p_organizacao_id: organizacaoId });
                    if (error) return reject(new Error(error.message));
                    if (data && data.success) resolve(data.message); else reject(new Error(data.message || 'Erro.'));
                });
                toast.promise(promise, { loading: 'Duplicando...', success: (message) => { onUpdate(); return message; }, error: (err) => `Erro: ${err.message}` });
            }},
            cancel: { label: "Cancelar" }
        });
    };

    // --- LÓGICA DE PERMUTAS (Inalterada) ---
    const handleAddPermuta = async () => {
        if (!newPermuta.descricao || !newPermuta.valor_permutado || !newPermuta.data_registro) return toast.error("Preencha todos os campos da permuta.");
        if (!organizacaoId) return toast.error("Organização não identificada.");
        setLoading(true);
        const valorNumerico = parseFloat(newPermuta.valor_permutado) || 0;
        const { error } = await supabase.from('contrato_permutas').insert({ contrato_id: contratoId, ...newPermuta, valor_permutado: valorNumerico, organizacao_id: organizacaoId });
        if (error) { toast.error("Erro: " + error.message); } 
        else { toast.success("Permuta adicionada!"); setNewPermuta({ descricao: '', valor_permutado: '', data_registro: new Date().toISOString().split('T')[0] }); onUpdate(); }
        setLoading(false);
    };

    const handleDeletePermuta = (permutaId) => {
        toast("Confirmar Exclusão", {
            description: "Tem certeza que deseja excluir esta permuta?",
            action: { label: "Excluir", onClick: () => {
                setLoading(true);
                const promise = supabase.from('contrato_permutas').delete().eq('id', permutaId);
                toast.promise(promise, { loading: 'Excluindo...', success: () => { onUpdate(); return "Permuta excluída."; }, error: (err) => `Erro: ${err.message}`, finally: () => setLoading(false) });
            }},
            cancel: { label: "Cancelar" }, classNames: { actionButton: 'bg-red-600' }
        });
    };
    
    // --- LÓGICA DE EDIÇÃO (Inalterada) ---
    const handleStartEditingParcela = (parcela) => { setEditingParcelaId(parcela.id); setEditingParcelaData(parcela); };
    const handleCancelEditingParcela = () => { setEditingParcelaId(null); setEditingParcelaData({}); };
    const handleEditingParcelaChange = (field, value) => setEditingParcelaData(prev => ({ ...prev, [field]: value }));
    
    return (
        <div>
            {/* --- BLOCO DE ESTILOS (Inalterado) --- */}
            <style jsx global>{`
                @media print { 
                    body * { visibility: hidden; } 
                    [data-sonner-toast] { visibility: hidden !important; display: none !important; }
                    .printable-area, .printable-area * { visibility: visible; } 
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; padding-left: 1.5cm; box-sizing: border-box; } 
                } 
            `}</style>
            
            {/* --- ÁREA DE IMPRESSÃO (Inalterada) --- */}
            <div className="hidden print:block printable-area">
                <PlanoPagamentoPrint contrato={contrato} signatory={selectedSignatory} geradoPor={geradoPor} />
            </div>

            {/* --- CONTEÚDO DA TELA (Renderização das Permutas Inalterada) --- */}
            <div className="print:hidden bg-white p-6 rounded-lg shadow-md border space-y-6">
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faExchangeAlt} /> Permutas Registradas</h3>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold">Descrição</th>
                                    <th className="px-4 py-2 text-left font-semibold">Data</th>
                                    <th className="px-4 py-2 text-right font-semibold">Valor (R$)</th>
                                    <th className="px-4 py-2 text-center font-semibold">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y">
                                {localPermutas.map(p => (
                                    <tr key={p.id}>
                                        <td className="px-4 py-3">{p.descricao}</td>
                                        <td className="px-4 py-3">{formatDateForDisplay(p.data_registro)}</td>
                                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.valor_permutado)}</td>
                                        <td className="px-4 py-3 text-center"><button onClick={() => handleDeletePermuta(p.id)} disabled={loading} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button></td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-50">
                                    <td className="px-4 py-2"><input type="text" placeholder="Descrição do bem" value={newPermuta.descricao} onChange={e => setNewPermuta({...newPermuta, descricao: e.target.value})} className="p-2 border rounded w-full"/></td>
                                    <td className="px-4 py-2"><input type="date" value={newPermuta.data_registro} onChange={e => setNewPermuta({...newPermuta, data_registro: e.target.value})} className="p-2 border rounded w-full"/></td>
                                    <td className="px-4 py-2"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(newPermuta.valor_permutado || '')} onAccept={(value) => setNewPermuta({...newPermuta, valor_permutado: value})} className="p-2 border rounded w-full text-right"/></td>
                                    <td className="px-4 py-2 text-center"><button onClick={handleAddPermuta} disabled={loading} className="bg-green-500 text-white px-3 py-1 rounded-md text-xs hover:bg-green-600">{loading ? <FontAwesomeIcon icon={faSpinner} spin/> : <><FontAwesomeIcon icon={faPlus}/> Add</>}</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* --- CONTEÚDO DA TELA (Cronograma de Parcelas) --- */}
                <div className="space-y-4 pt-6 border-t">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faFileInvoiceDollar} /> Cronograma de Parcelas</h3>
                        <div className="flex items-center gap-2">
                            <select value={selectedSignatoryId} onChange={(e) => setSelectedSignatoryId(e.target.value)} className="p-2 border rounded-md text-sm bg-gray-50">
                                <option value="" disabled>Assinatura do Responsável</option>
                                {proprietarios.map(p => <option key={p.id} value={p.id}>{p.nome} {p.sobrenome}</option>)}
                            </select>
                            <button onClick={() => window.print()} disabled={!selectedSignatoryId} className="bg-gray-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-gray-700 flex items-center gap-2 disabled:bg-gray-400"><FontAwesomeIcon icon={faPrint} /> Imprimir</button>
                            <button onClick={handleProvisionarLancamentos} disabled={!hasPendingParcelsToProvision || isProvisioning} className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"><FontAwesomeIcon icon={isProvisioning ? faSpinner : faLink} spin={isProvisioning} />{isProvisioning ? 'Sincronizando...' : 'Sincronizar'}</button>
                        </div>
                    </div>
                    
                    {/* --- Alerta de Sincronia (Inalterado) --- */}
                    {Math.abs(diferencaDeSincronia) > 0.01 && (
                        <div className="p-3 bg-yellow-100 text-yellow-800 rounded-md flex items-center gap-3 text-sm">
                            <FontAwesomeIcon icon={faExclamationTriangle} />
                            <span>O valor do Saldo Remanescente no banco está <strong>{formatCurrency(diferencaDeSincronia)}</strong> diferente do valor calculado. Salve e Recalcule o plano para sincronizar.</span>
                        </div>
                    )}
                    
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-center font-bold uppercase w-12">FIN.</th>
                                    <th className="px-4 py-3 text-left font-bold uppercase w-2/5">Descrição</th>
                                    <th className="px-4 py-3 text-left font-bold uppercase">Tipo</th>
                                    <th className="px-4 py-3 text-left font-bold uppercase">Vencimento</th>
                                    <th className="px-4 py-3 text-right font-bold uppercase">Valor</th>
                                    <th className="px-4 py-3 text-center font-bold uppercase">Status</th>
                                    <th className="px-4 py-3 text-center font-bold uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y">
                                {/* --- Mapeamento das parcelas (Inalterado) --- */}
                                {parcelasOrdenadas.map(p => {
                                    const statusInfo = getParcelaStatus(p);
                                    let dateClass = statusInfo.text === 'Atrasada' ? 'text-red-600 font-bold' : '';
                                    return ( editingParcelaId === p.id ? ( <tr key={p.id} className="bg-yellow-50"> <td className="px-4 py-2"></td> <td className="px-4 py-2"><input type="text" value={editingParcelaData.descricao} onChange={e => handleEditingParcelaChange('descricao', e.target.value)} className="p-2 border rounded w-full bg-yellow-100"/></td> <td className="px-4 py-2">{p.tipo}</td> <td className="px-4 py-2"><input type="date" value={formatDateForInput(editingParcelaData.data_vencimento)} onChange={e => handleEditingParcelaChange('data_vencimento', e.target.value)} className="p-2 border rounded w-full bg-yellow-100"/></td>
                                    <td className="px-4 py-2"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(editingParcelaData.valor_parcela || '')} onAccept={(value) => handleEditingParcelaChange('valor_parcela', value)} className="p-2 border rounded w-full text-right bg-yellow-100"/></td>
                                    <td className="px-4 py-2 text-center">{p.status_pagamento}</td> <td className="px-4 py-2 text-center"> <div className="flex justify-center items-center gap-3"> <button onClick={() => handleSaveEditingParcela(p.id)} disabled={loading} className="text-green-600" title="Salvar"><FontAwesomeIcon icon={faSave} /></button> <button onClick={handleCancelEditingParcela} className="text-gray-500" title="Cancelar"><FontAwesomeIcon icon={faTimes} /></button> </div> </td> </tr> ) : ( <tr key={p.id} className="hover:bg-gray-50"> <td className="px-4 py-3 text-center">{p.lancamento_id && <FontAwesomeIcon icon={faLink} className="text-green-500" title={`Vinculado #${p.lancamento_id}`} />}</td> <td className="px-4 py-3 font-medium">{p.descricao}</td> <td className="px-4 py-3 text-gray-600">{p.tipo}</td> <td className={`px-4 py-3 whitespace-nowrap ${dateClass}`}>{formatDateForDisplay(p.data_vencimento)}</td> <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(p.valor_parcela)}</td> <td className="px-4 py-3 text-center"> <span className={`px-2 py-1 font-semibold leading-tight rounded-full ${statusInfo.className}`}> {statusInfo.text.toUpperCase()} </span> </td> <td className="px-4 py-3 text-center"> <div className="flex justify-center items-center gap-4"> <button onClick={() => handleDuplicateParcela(p.id)} disabled={loading} className="text-gray-500 hover:text-gray-700" title="Duplicar"><FontAwesomeIcon icon={faCopy} /></button> {p.status_pagamento === 'Pendente' && <button onClick={() => handleStartEditingParcela(p)} className="text-blue-600 hover:text-blue-800" title="Editar"><FontAwesomeIcon icon={faPen} /></button>} <button onClick={() => handleDeleteParcela(p.id)} disabled={loading} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button> </div> </td> </tr> ) )
                                })}
                                
                                {/* --- Formulário de Nova Parcela (Inalterado) --- */}
                                <tr className="bg-gray-50"> <td className="px-4 py-2"></td> <td className="px-4 py-2"><input type="text" placeholder="Nova Parcela Adicional" value={newParcela.descricao} onChange={e => setNewParcela({...newParcela, descricao: e.target.value})} className="p-2 border rounded w-full"/></td> <td className="px-4 py-2 text-gray-600">Adicional</td> <td className="px-4 py-2"><input type="date" value={newParcela.data_vencimento} onChange={e => setNewParcela({...newParcela, data_vencimento: e.target.value})} className="p-2 border rounded w-full"/></td>
                                <td className="px-4 py-2"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(newParcela.valor_parcela || '')} onAccept={(value) => setNewParcela({...newParcela, valor_parcela: value})} className="p-2 border rounded w-full text-right"/></td>
                                <td className="px-4 py-2 text-center text-gray-600">Pendente</td> <td className="px-4 py-2 text-center"><button onClick={handleAddParcela} disabled={loading} className="bg-green-500 text-white px-3 py-1 rounded-md text-xs hover:bg-green-600">{loading ? <FontAwesomeIcon icon={faSpinner} spin/> : <><FontAwesomeIcon icon={faPlus}/> Add</>}</button></td> </tr>
                            </tbody>

                            {/* ================================================================== */}
                            {/* MUDANÇA AQUI: Rodapé (tfoot) com a linha "DIFERENÇA" REMOVIDA */}
                            {/* ================================================================== */}
                            <tfoot className="bg-gray-200 font-bold text-sm">
                                <tr>
                                    {/* 1. Total das parcelas "normais" (incluindo adicionais) */}
                                    <td colSpan="6" className="text-right px-4 py-2">Total Parcelas (Entrada + Obra + Adicionais):</td>
                                    <td colSpan="2" className="text-right px-4 py-2">{formatCurrency(totalParcelasNormais)}</td>
                                </tr>
                                
                                    {/* 2. O Saldo Remanescente CALCULADO dinamicamente */}
                                <tr className="bg-gray-200">
                                    <td colSpan="6" className="text-right px-4 py-2 font-semibold text-blue-800">{displaySaldoRemanescente.descricao}:</td>
                                    <td colSpan="2" className="text-right px-4 py-2 font-semibold text-blue-800">{formatCurrency(displaySaldoRemanescente.valor_parcela)}</td>
                                </tr>
                                
                                <tr className="bg-gray-300">
                                    <td colSpan="6" className="text-right px-4 py-3 text-base">VALOR TOTAL (Contrato):</td>
                                    <td colSpan="2" className="text-right px-4 py-3 text-base">{formatCurrency(valorTotalContrato)}</td>
                                </tr>
                                
                                {/* 3. A linha de DIFERENÇA foi removida daqui! */}

                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}