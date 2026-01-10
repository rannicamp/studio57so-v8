// components/financeiro/conciliacao/index.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faEye, faEyeSlash, faSearch, faCalendarAlt, 
    faSortAmountDown, faSortAmountUp, faFilter, faMagic, faRobot 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

import ConciliacaoHeader from './ConciliacaoHeader';
import ConciliacaoItem from './ConciliacaoItem';
import ConciliacaoFooter from './ConciliacaoFooter';
import LancamentoFormModal from '../LancamentoFormModal';

const STORAGE_KEY = 'conciliacao_state_v3'; 

// --- Helpers ---
const daysBetween = (date1, date2) => {
    if (!date1 || !date2) return 999;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)); 
};

const fetchLancamentosSistema = async (supabase, contaId, organizacaoId, startDate, endDate) => {
    if (!contaId || !organizacaoId || !startDate || !endDate) return [];
    
    const { data, error } = await supabase
        .from('lancamentos')
        .select(`*, favorecido:favorecido_contato_id (id, nome, razao_social)`)
        .eq('conta_id', contaId)
        .eq('organizacao_id', organizacaoId)
        .or(`data_pagamento.gte.${startDate},data_vencimento.gte.${startDate},data_transacao.gte.${startDate}`)
        .or(`data_pagamento.lte.${endDate},data_vencimento.lte.${endDate},data_transacao.lte.${endDate}`);
    
    if (error) throw new Error(error.message);
    return data;
};

// --- Toolbar (Componente Interno) ---
const ListToolbar = ({ title, count, searchTerm, setSearchTerm, sortConfig, handleSort, dateFilter, handleDateFilter, color = 'gray', showConciliados, setShowConciliados, onAiMatch, isAiLoading }) => (
    <div className={`mb-2 p-2 bg-${color}-50 rounded-lg border border-${color}-200`}>
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <h3 className={`font-bold text-${color}-800 flex items-center gap-2`}>
                    {title} <span className="bg-white text-gray-600 text-xs px-2 py-0.5 rounded-full border border-gray-200">{count}</span>
                </h3>
                
                <div className="flex gap-2">
                    {/* Botão de Match IA (Só aparece no toolbar do Sistema, pois a ação cruza os dois) */}
                    {onAiMatch && (
                        <button 
                            onClick={onAiMatch} 
                            disabled={isAiLoading}
                            className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 border border-purple-200 font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                            title="Usar IA para encontrar pares automaticamente"
                        >
                            {isAiLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faMagic} />}
                            {isAiLoading ? 'Analisando...' : 'IA Match'}
                        </button>
                    )}

                    {setShowConciliados && (
                        <button onClick={()=>setShowConciliados(!showConciliados)} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
                            <FontAwesomeIcon icon={showConciliados?faEyeSlash:faEye}/> {showConciliados?'Ocultar':'Ver'} Conciliados
                        </button>
                    )}
                </div>
            </div>
            
            <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                </div>
                <input 
                    type="text" placeholder="Buscar descrição ou valor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                    {['data', 'descricao', 'valor'].map(key => (
                        <button key={key} onClick={() => handleSort(key)} className={`px-2 py-1 text-[10px] uppercase font-bold rounded border transition-colors ${sortConfig.key === key ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-600'}`}>
                            {key.substr(0,4)} <FontAwesomeIcon icon={sortConfig.key === key && sortConfig.direction === 'asc' ? faSortAmountUp : faSortAmountDown} className="ml-1"/>
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded border border-gray-200">
                    <FontAwesomeIcon icon={faCalendarAlt} className="text-gray-400 text-xs ml-1" />
                    <input type="date" value={dateFilter.startDate || ''} onChange={(e) => handleDateFilter('startDate', e.target.value)} className="bg-transparent text-[10px] border-none focus:ring-0 p-0 text-gray-600 w-20" />
                    <span className="text-gray-400 text-[10px]">-</span>
                    <input type="date" value={dateFilter.endDate || ''} onChange={(e) => handleDateFilter('endDate', e.target.value)} className="bg-transparent text-[10px] border-none focus:ring-0 p-0 text-gray-600 w-20" />
                </div>
            </div>
        </div>
    </div>
);

export default function ConciliacaoManager({ contas }) {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();
    const queryClient = useQueryClient();

    // --- ESTADOS ---
    const getInitialState = () => {
        if (typeof window === 'undefined') return {};
        try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
    };
    const savedState = getInitialState();

    const [selectedContaId, setSelectedContaId] = useState(savedState.selectedContaId || '');
    const selectedConta = useMemo(() => contas.find(c => c.id == selectedContaId), [contas, selectedContaId]);
    const isCartaoCredito = selectedConta?.tipo === 'Cartão de Crédito';

    const [inputMode, setInputMode] = useState('ofx');
    const [file, setFile] = useState(null);
    const [pastedText, setPastedText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAiMatching, setIsAiMatching] = useState(false); // Novo estado para loading da IA

    const [conciliationState, setConciliationState] = useState({ 
        extrato: savedState.extrato || [], sistema: [], matches: savedState.matches || [], dateFilter: savedState.dateFilter || { startDate: '', endDate: '' } 
    });
    
    const [extratoPeriodo, setExtratoPeriodo] = useState(savedState.extratoPeriodo || { startDate: null, endDate: null });
    const [sysSearchTerm, setSysSearchTerm] = useState(savedState.sysSearchTerm || '');
    const [sysSortConfig, setSysSortConfig] = useState(savedState.sysSortConfig || { key: 'data', direction: 'asc' });
    const [extSearchTerm, setExtSearchTerm] = useState(savedState.extSearchTerm || '');
    const [extSortConfig, setExtSortConfig] = useState(savedState.extSortConfig || { key: 'data', direction: 'asc' });
    const [extLocalFilter, setExtLocalFilter] = useState(savedState.extLocalFilter || { startDate: '', endDate: '' });

    const [selectedExtratoId, setSelectedExtratoId] = useState(null);
    const [selectedSistemaIds, setSelectedSistemaIds] = useState(new Set());
    const [showConciliados, setShowConciliados] = useState(savedState.showConciliados || false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [lancamentoParaCriar, setLancamentoParaCriar] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [lancamentoParaEditar, setLancamentoParaEditar] = useState(null);

    // --- PERSISTÊNCIA ---
    useEffect(() => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
            selectedContaId, sysSearchTerm, sysSortConfig, extSearchTerm, extSortConfig, extLocalFilter, extratoPeriodo,
            dateFilter: conciliationState.dateFilter, extrato: conciliationState.extrato, matches: conciliationState.matches, showConciliados
        }));
    }, [selectedContaId, sysSearchTerm, sysSortConfig, extSearchTerm, extSortConfig, extLocalFilter, extratoPeriodo, conciliationState, showConciliados]);

    const getDisplayDate = (lancamento) => {
        if (!lancamento) return 'N/A';
        return isCartaoCredito ? (lancamento.data_transacao || lancamento.data_vencimento) : (lancamento.data_pagamento || lancamento.data_vencimento);
    };

    // --- QUERY ---
    const { data: lancamentosSistema, isLoading: isLoadingLancamentos } = useQuery({
        queryKey: ['lancamentosSistemaConciliacao', selectedContaId, organizacao_id, extratoPeriodo.startDate, extratoPeriodo.endDate],
        queryFn: () => fetchLancamentosSistema(supabase, selectedContaId, organizacao_id, extratoPeriodo.startDate, extratoPeriodo.endDate),
        enabled: !!(selectedContaId && organizacao_id && extratoPeriodo.startDate),
        staleTime: 1000 * 60 * 5 
    });

    // Atualiza lista do sistema quando query muda
    useEffect(() => {
        if (lancamentosSistema) setConciliationState(prev => ({ ...prev, sistema: lancamentosSistema }));
    }, [lancamentosSistema]);

    // --- NOVO: FUNÇÃO DE MATCH VIA IA ---
    const handleAiMatch = async () => {
        if (conciliationState.extrato.length === 0 || conciliationState.sistema.length === 0) {
            return toast.warning("É preciso ter itens nas duas listas para usar a IA.");
        }

        setIsAiMatching(true);
        try {
            // Filtra apenas o que NÃO está conciliado e nem matchado na sessão
            const pendentesExtrato = conciliationState.extrato.filter(e => !conciliationState.matches.some(m => m.extratoId === e.id));
            const pendentesSistema = conciliationState.sistema.filter(s => !s.conciliado && !conciliationState.matches.some(m => m.sistemaId === s.id));

            if (pendentesExtrato.length === 0 || pendentesSistema.length === 0) {
                throw new Error("Não há itens pendentes para conciliar.");
            }

            const response = await fetch('/api/conciliacao/match-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extrato: pendentesExtrato, sistema: pendentesSistema })
            });

            if (!response.ok) throw new Error("Erro ao consultar a IA.");

            const { matches } = await response.json();

            if (matches && matches.length > 0) {
                setConciliationState(prev => {
                    let pairCounter = prev.matches.length > 0 ? Math.max(...prev.matches.map(m=>m.pairId)) + 1 : 0;
                    const newMatches = matches.map(m => ({
                        extratoId: m.extratoId,
                        sistemaId: m.sistemaId,
                        pairId: pairCounter++
                    }));
                    return { ...prev, matches: [...prev.matches, ...newMatches] };
                });
                toast.success(`A IA encontrou ${matches.length} novos pares! ✨`);
            } else {
                toast.info("A IA analisou mas não encontrou correspondências óbvias.");
            }

        } catch (error) {
            console.error(error);
            toast.error(error.message);
        } finally {
            setIsAiMatching(false);
        }
    };

    // --- PARSERS E UPLOAD ---
    const handleProcessFile = async () => {
        if (!selectedContaId) return toast.warning('Selecione uma conta.');
        setIsProcessing(true);
        setConciliationState(prev => ({ ...prev, matches: [], extrato: [] }));
        
        let transacoes = [];
        // ... (Mesma lógica de parseOfx, parseCsv e PDF)
        const parseOfx = (text) => {
             const res = []; const rx = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g; let m; let i=0;
             while ((m = rx.exec(text)) !== null) {
                 const b = m[1]; const get = t => { const r=new RegExp(`<${t}>([^<]*)`); const x=r.exec(b); return x?x[1].trim():null;};
                 const v = parseFloat(get('TRNAMT')); const d=get('DTPOSTED')?.substring(0,8);
                 if(d && !isNaN(v)) res.push({ id: (get('FITID')||`GEN_${i}_${Date.now()}`), data: `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`, valor: v, descricao: get('MEMO')||get('NAME')||'Item OFX' });
                 i++;
             }
             return res;
        };
        const parseCsv = (text) => {
            const lines = text.split(/\r?\n/).filter(x => x.trim()); const res = [];
            lines.forEach((l, idx) => {
                if (l.toLowerCase().includes('valor') && l.toLowerCase().includes('descricao')) return; 
                const separator = l.includes(';') ? ';' : ','; const parts = l.split(separator).map(x => x.trim());
                let d, v, desc = '';
                for (const x of parts) {
                    if (!d && /^\d{4}-\d{2}-\d{2}$/.test(x)) d = x;
                    else if (!d && /^\d{2}\/\d{2}\/\d{4}$/.test(x)) d = x.split('/').reverse().join('-');
                    else if (v === undefined) {
                         const cleanVal = x.replace(/[R$\s]/g, '');
                         if (/^-?\d+\.\d+$/.test(cleanVal) && !cleanVal.includes(',')) v = parseFloat(cleanVal);
                         else if (/^-?\d+,\d+$/.test(cleanVal)) v = parseFloat(cleanVal.replace(',', '.'));
                         else if (/^-?[\d\.]+,\d+$/.test(cleanVal)) v = parseFloat(cleanVal.replace(/\./g, '').replace(',', '.'));
                    }
                    if (!d && v === undefined) desc += (desc?' ':'')+x;
                }
                if (!desc) desc = parts.find(item => item !== d && parseFloat(item) !== v) || 'Item Importado';
                if (d && v !== undefined) res.push({ id: `CSV_${idx}_${Date.now()}`, data: d, valor: v, descricao: desc.trim() || 'Sem descrição' });
            });
            return res;
        };

        try {
            if (inputMode === 'ofx' && file) transacoes = parseOfx(await file.text());
            else if (inputMode === 'csv' && pastedText) transacoes = parseCsv(pastedText);
            else if (inputMode === 'pdf' && file) {
                const formData = new FormData(); formData.append('file', file);
                const response = await fetch('/api/extract-pdf', { method: 'POST', body: formData });
                if (!response.ok) throw new Error((await response.json()).error || 'Erro PDF');
                const data = await response.json();
                if (data.csv) transacoes = parseCsv(data.csv);
                else throw new Error("IA sem dados.");
            }
            if(!transacoes.length) throw new Error("Nenhuma transação encontrada.");
            
            const dates = transacoes.map(t => new Date(t.data));
            const min = new Date(Math.min(...dates)).toISOString().split('T')[0];
            const max = new Date(Math.max(...dates)).toISOString().split('T')[0];
            setExtratoPeriodo({ startDate: min, endDate: max });
            setExtLocalFilter({ startDate: min, endDate: max });
            setConciliationState({ extrato: transacoes, sistema: [], matches: [], dateFilter: { startDate: min, endDate: max } });
        } catch (e) { toast.error(e.message); setIsProcessing(false); }
    };

    // --- ACTIONS GERAIS ---
    const proceedWithMatch = () => {
        const newPairId = (conciliationState.matches.at(-1)?.pairId || 0) + 1;
        const newMatches = Array.from(selectedSistemaIds).map(sid => ({ extratoId: selectedExtratoId, sistemaId: sid, pairId: newPairId }));
        setConciliationState(prev => ({ ...prev, matches: [...prev.matches, ...newMatches] }));
        setSelectedExtratoId(null); setSelectedSistemaIds(new Set());
    };

    const confirmAllMatches = async () => {
        setIsProcessing(true);
        try {
            for (const m of conciliationState.matches) {
                const ex = conciliationState.extrato.find(e => e.id === m.extratoId);
                await supabase.from('lancamentos').update({ 
                    conciliado: true, status: 'Pago', data_pagamento: ex.data, id_transacao_externa: m.extratoId 
                }).eq('id', m.sistemaId);
            }
            toast.success("Conciliado com sucesso!");
            queryClient.invalidateQueries(['lancamentosSistemaConciliacao']);
            setConciliationState(prev => ({ ...prev, matches: [] }));
        } catch (e) { toast.error(e.message); } finally { setIsProcessing(false); }
    };

    const handleItemAction = async (action, item) => {
        if (action === 'create') {
             setLancamentoParaCriar({ descricao: item.descricao, valor: Math.abs(item.valor), tipo: item.valor > 0 ? 'Receita' : 'Despesa', conta_id: selectedContaId, data_transacao: item.data, data_vencimento: item.data, data_pagamento: item.data, status: 'Pago', conciliado: true, id_transacao_externa: item.id });
             setIsModalOpen(true);
        } else if (action === 'delete') {
            await supabase.from('lancamentos').delete().eq('id', item.id);
            queryClient.invalidateQueries(['lancamentosSistemaConciliacao']);
            setConciliationState(p => ({...p, sistema: p.sistema.filter(s => s.id !== item.id)}));
        } else if (action === 'undo') {
            await supabase.from('lancamentos').update({ conciliado: false, status: 'Pendente', id_transacao_externa: null }).eq('id', item.id);
            queryClient.invalidateQueries(['lancamentosSistemaConciliacao']);
        } else if (action === 'edit') {
            setLancamentoParaEditar(item); setIsEditModalOpen(true);
        } else if (action === 'removeMatch') {
             setConciliationState(prev => ({...prev, matches: prev.matches.filter(m => m.pairId !== item.pairId)}));
        }
    };

    const handleCreateSuccess = (newItem) => {
        const extratoId = newItem.id_transacao_externa;
        setConciliationState(prev => {
            const newMatches = [...prev.matches];
            if (extratoId) newMatches.push({ extratoId: extratoId, sistemaId: newItem.id, pairId: (prev.matches.at(-1)?.pairId || 0) + 1 });
            return { ...prev, sistema: [...prev.sistema, { ...newItem, conciliado: !!extratoId }], matches: newMatches };
        });
        queryClient.invalidateQueries(['lancamentosSistemaConciliacao']);
        setIsModalOpen(false);
    };

    const resetState = () => {
        sessionStorage.removeItem(STORAGE_KEY);
        setFile(null); setPastedText('');
        setConciliationState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } });
        setExtratoPeriodo({ startDate: null, endDate: null });
        setExtLocalFilter({ startDate: '', endDate: '' });
        setSelectedExtratoId(null); setSelectedSistemaIds(new Set());
    };

    const handleSysSort = (key) => setSysSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    const handleExtSort = (key) => setExtSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    
    // --- CALCULADORA E LISTAS ---
    const calculadora = useMemo(() => {
        if (!selectedExtratoId) return null;
        const ex = conciliationState.extrato.find(e => e.id === selectedExtratoId);
        if(!ex) return null;
        const sysTotal = Array.from(selectedSistemaIds).reduce((acc, id) => acc + (Math.abs(conciliationState.sistema.find(x => x.id === id)?.valor || 0)), 0);
        return { target: Math.abs(ex.valor), totalSistema: sysTotal, diff: Math.abs(ex.valor) - sysTotal, isMatch: Math.abs(Math.abs(ex.valor) - sysTotal) < 0.01 };
    }, [selectedExtratoId, selectedSistemaIds, conciliationState]);

    const processedLists = useMemo(() => {
        const matchedSys = new Set(conciliationState.matches.map(m => m.sistemaId));
        const matchedExt = new Set(conciliationState.matches.map(m => m.extratoId));
        
        let sistemaList = conciliationState.sistema;
        if (sysSearchTerm) sistemaList = sistemaList.filter(i => i.descricao.toLowerCase().includes(sysSearchTerm.toLowerCase()) || i.valor.toString().includes(sysSearchTerm));
        if (selectedExtratoId) {
            const ex = conciliationState.extrato.find(e => e.id === selectedExtratoId);
            if (ex) sistemaList = sistemaList.filter(sys => {
                if (selectedSistemaIds.has(sys.id)) return true;
                return (Math.abs(Math.abs(sys.valor) - Math.abs(ex.valor)) < 5) || (daysBetween(getDisplayDate(sys), ex.data) <= 5);
            });
        }
        sistemaList = sistemaList.map(i => ({ ...i, conciliationStatus: (matchedSys.has(i.id)) ? 'sessionMatch' : (i.conciliado?'dbConciliated':'pendente') })).filter(i => showConciliados || i.conciliationStatus !== 'dbConciliated');
        sistemaList.sort((a, b) => {
             const s = { sessionMatch: 1, pendente: 2, dbConciliated: 3 };
             if (s[a.conciliationStatus] !== s[b.conciliationStatus]) return s[a.conciliationStatus] - s[b.conciliationStatus];
             let valA = a[sysSortConfig.key], valB = b[sysSortConfig.key];
             if(sysSortConfig.key==='valor') { valA=Math.abs(valA); valB=Math.abs(valB); }
             else if(sysSortConfig.key==='data') { valA=getDisplayDate(a); valB=getDisplayDate(b); }
             return sysSortConfig.direction === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });

        let extratoList = conciliationState.extrato;
        if (extSearchTerm) extratoList = extratoList.filter(i => i.descricao.toLowerCase().includes(extSearchTerm.toLowerCase()) || i.valor.toString().includes(extSearchTerm));
        if (extLocalFilter.startDate && extLocalFilter.endDate) extratoList = extratoList.filter(i => i.data >= extLocalFilter.startDate && i.data <= extLocalFilter.endDate);
        extratoList = extratoList.map(i => ({ ...i, conciliationStatus: (matchedExt.has(i.id)) ? 'sessionMatch' : 'pendente' })).filter(i => showConciliados || i.conciliationStatus !== 'dbConciliated');
        extratoList.sort((a, b) => {
             const s = { sessionMatch: 1, pendente: 2 };
             if (s[a.conciliationStatus] !== s[b.conciliationStatus]) return s[a.conciliationStatus] - s[b.conciliationStatus];
             let valA = a[extSortConfig.key], valB = b[extSortConfig.key];
             if(extSortConfig.key==='valor') { valA=Math.abs(valA); valB=Math.abs(valB); }
             return extSortConfig.direction === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });

        return { sistema: sistemaList, extrato: extratoList };
    }, [conciliationState, selectedExtratoId, selectedSistemaIds, showConciliados, sysSearchTerm, sysSortConfig, extSearchTerm, extSortConfig, extLocalFilter]);

    return (
        <div className="space-y-6 pb-24">
            <LancamentoFormModal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} onSuccess={handleCreateSuccess} initialData={lancamentoParaCriar} />
            <LancamentoFormModal isOpen={isEditModalOpen} onClose={()=>setIsEditModalOpen(false)} onSuccess={()=>{queryClient.invalidateQueries(['lancamentosSistemaConciliacao']); setIsEditModalOpen(false);}} initialData={lancamentoParaEditar} />
            
            <ConciliacaoHeader 
                contas={contas} selectedContaId={selectedContaId} setSelectedContaId={setSelectedContaId}
                isCartaoCredito={isCartaoCredito} inputMode={inputMode} setInputMode={setInputMode}
                file={file} setFile={setFile} pastedText={pastedText} setPastedText={setPastedText}
                isProcessing={isProcessing} onProcess={handleProcessFile} onReset={resetState}
            />

            {conciliationState.extrato.length > 0 && (
                <div className="relative pt-6 border-t min-h-[400px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col h-[750px] bg-white border border-gray-200 rounded-lg shadow-sm">
                            <div className="p-2 border-b border-gray-100">
                                <ListToolbar 
                                    title="Sistema" count={processedLists.sistema.length} searchTerm={sysSearchTerm} setSearchTerm={setSysSearchTerm}
                                    sortConfig={sysSortConfig} handleSort={handleSysSort} dateFilter={extratoPeriodo} handleDateFilter={(f, v) => setExtratoPeriodo(p => ({...p, [f]: v}))}
                                    color="gray" showConciliados={showConciliados} setShowConciliados={setShowConciliados}
                                    onAiMatch={handleAiMatch} isAiLoading={isAiMatching}
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 bg-white custom-scrollbar space-y-1">
                                {isLoadingLancamentos ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                        <FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-2 text-blue-500" />
                                        <p className="text-sm">Buscando lançamentos...</p>
                                    </div>
                                ) : processedLists.sistema.map(item => (
                                    <ConciliacaoItem 
                                        key={item.id} item={item} type="sistema" listName="sistema" isCartaoCredito={isCartaoCredito} getDisplayDate={getDisplayDate}
                                        isSelected={selectedSistemaIds.has(item.id)} match={conciliationState.matches.find(m => m.sistemaId === item.id)}
                                        onItemClick={(it) => { if(it.conciliationStatus==='pendente') setSelectedSistemaIds(p => { const n=new Set(p); if(n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; }); }}
                                        onAction={handleItemAction}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col h-[750px] bg-white border border-gray-200 rounded-lg shadow-sm">
                            <div className="p-2 border-b border-gray-100">
                                <ListToolbar 
                                    title="Extrato Bancário" count={processedLists.extrato.length} searchTerm={extSearchTerm} setSearchTerm={setExtSearchTerm}
                                    sortConfig={extSortConfig} handleSort={handleExtSort} dateFilter={extLocalFilter} handleDateFilter={(f, v) => setExtLocalFilter(p => ({...p, [f]: v}))} color="blue"
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 bg-white custom-scrollbar space-y-1">
                                {processedLists.extrato.map(item => (
                                    <ConciliacaoItem 
                                        key={item.id} item={item} type="extrato" listName="extrato" isCartaoCredito={isCartaoCredito}
                                        isSelected={selectedExtratoId === item.id} match={conciliationState.matches.find(m => m.extratoId === item.id)}
                                        onItemClick={(it) => { if(it.conciliationStatus==='pendente') { setSelectedExtratoId(p => p===it.id?null:it.id); setSelectedSistemaIds(new Set()); } }}
                                        onAction={handleItemAction}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <ConciliacaoFooter calculadora={calculadora} matchesCount={conciliationState.matches.length} onProceedMatch={proceedWithMatch} onCancelSelection={()=>{setSelectedExtratoId(null); setSelectedSistemaIds(new Set());}} onConfirmAll={confirmAllMatches} isProcessing={isProcessing} />
        </div>
    );
}