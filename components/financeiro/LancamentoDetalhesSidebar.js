// components/financeiro/LancamentoDetalhesSidebar.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, faStickyNote, faBuilding, faFileInvoice, faCalendarAlt, faDollarSign, 
    faTags, faUser, faLandmark, faFileLines, faEye, faSpinner, 
    faArrowUp, faArrowDown, faCheckCircle, faExclamationTriangle, faRobot, faCheck, faClock, faPen, faSave
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// --- FUNÇÕES AUXILIARES ---
const formatDateString = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        if (dateStr.includes('T')) return date.toLocaleDateString('pt-BR');
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    } catch (e) { return dateStr; }
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

// Componente de Campo Simples
const InfoField = ({ label, value, icon, valueClassName = '' }) => (
    <div>
        <dt className="text-xs font-semibold text-gray-500 flex items-center gap-2 uppercase">
            <FontAwesomeIcon icon={icon} className="w-4" />
            {label}
        </dt>
        <dd className={`mt-1 text-sm text-gray-800 ${valueClassName}`}>{value || 'N/A'}</dd>
    </div>
);

// Componente de Anexos
const AnexosSection = ({ anexos }) => {
    const supabase = createClient();
    
    const handleViewAnexo = async (caminho) => {
        if (!caminho) return;
        const { data } = supabase.storage.from('documentos-financeiro').getPublicUrl(caminho);
        if (data?.publicUrl) window.open(data.publicUrl, '_blank');
    };

    if (!anexos || anexos.length === 0) return <InfoField label="Anexos" value="Nenhum anexo." icon={faFileLines} />;

    return (
        <div>
            <dt className="text-xs font-semibold text-gray-500 flex items-center gap-2 uppercase mb-2">
                <FontAwesomeIcon icon={faFileLines} className="w-4" /> Anexos
            </dt>
            <div className="space-y-2">
                {anexos.map(anexo => (
                    <button key={anexo.id} onClick={() => handleViewAnexo(anexo.caminho_arquivo)} className="w-full flex items-center gap-3 p-2 bg-gray-100 rounded hover:bg-gray-200 text-left text-sm transition-colors">
                        <FontAwesomeIcon icon={faEye} className="text-gray-500" />
                        <span className="truncate flex-1 font-medium">{anexo.nome_arquivo || 'Documento'}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
export default function LancamentoDetalhesSidebar({ open, onClose, lancamento }) {
    const supabase = createClient();
    const { user } = useAuth();
    
    // Estados de Dados
    const [auditLog, setAuditLog] = useState(null);
    const [loadingLog, setLoadingLog] = useState(false);
    const [userProfile, setUserProfile] = useState(null);

    // Estados de Edição
    const [isEditingValue, setIsEditingValue] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [isSavingValue, setIsSavingValue] = useState(false);

    // --- 1. CARREGAMENTO INICIAL ---
    useEffect(() => {
        if (open && lancamento?.id) {
            fetchAuditLog();
            fetchUserProfile();
            setEditValue(lancamento.valor); // Prepara valor para edição
        } else {
            setAuditLog(null);
            setIsEditingValue(false);
        }
    }, [open, lancamento]);

    const fetchUserProfile = async () => {
        if (!user?.id) return;
        // Busca nome e função do usuário logado para validar permissão
        const { data, error } = await supabase
            .from('usuarios')
            .select('nome, funcoes(nome_funcao)')
            .eq('id', user.id)
            .single();
        
        if (!error && data) {
            setUserProfile({
                nome: data.nome,
                funcao: data.funcoes?.nome_funcao
            });
        }
    };

    const fetchAuditLog = async () => {
        setLoadingLog(true);
        const { data, error } = await supabase
            .from('auditoria_ia_logs')
            .select('*')
            .eq('lancamento_id', lancamento.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (!error && data) setAuditLog(data);
        else setAuditLog(null);
        setLoadingLog(false);
    };

    // --- 2. LÓGICA DE APROVAÇÃO MANUAL ---
    const handleAprovarManual = async () => {
        if (!userProfile) return toast.error("Perfil de usuário não carregado.");
        
        // Validação de Permissão (Só Proprietário)
        // Nota: Ajuste a string 'Proprietário' caso no seu banco esteja diferente (ex: 'Admin', 'Sócio')
        if (userProfile.funcao !== 'Proprietário') {
            return toast.error("Apenas Proprietários podem forçar a aprovação manual.");
        }

        if (!confirm(`Confirmar aprovação manual como ${userProfile.nome}?`)) return;

        try {
            // Atualiza status do lançamento
            await supabase.from('lancamentos').update({ status_auditoria_ia: 'Aprovado' }).eq('id', lancamento.id);
            
            // Cria log de auditoria com o nome do responsável
            await supabase.from('auditoria_ia_logs').insert({
                lancamento_id: lancamento.id,
                organizacao_id: lancamento.organizacao_id || user.user_metadata?.organizacao_id,
                status_auditoria: 'Aprovado',
                analise_ia: `Aprovado manualmente por ${userProfile.nome} (Revisão Humana).`,
                valor_identificado: lancamento.valor,
                modelo_ia: 'Humano'
            });
            
            toast.success("Aprovado com sucesso!");
            onClose(); 
        } catch (e) {
            toast.error("Erro ao aprovar.");
            console.error(e);
        }
    };

    // --- 3. LÓGICA DE EDIÇÃO DE VALOR ---
    const handleSaveValue = async () => {
        const novoValor = parseFloat(editValue);
        if (isNaN(novoValor) || novoValor <= 0) return toast.error("Valor inválido.");

        setIsSavingValue(true);
        try {
            // Atualiza o valor no banco
            const { error } = await supabase
                .from('lancamentos')
                .update({ valor: novoValor })
                .eq('id', lancamento.id);

            if (error) throw error;

            toast.success("Valor corrigido!");
            setIsEditingValue(false);
            
            // Atualiza o objeto local para refletir na tela imediatamente
            lancamento.valor = novoValor; 
            
            // Opcional: Se quiser re-auditar automaticamente após editar, descomente:
            // await fetch('/api/financeiro/auditoria-ia', { method: 'POST', body: JSON.stringify({ lancamentoId: lancamento.id }) });

        } catch (e) {
            toast.error("Erro ao salvar valor.");
        } finally {
            setIsSavingValue(false);
        }
    };

    // --- 4. LÓGICA DE STATUS VISUAL ---
    const getStatusInfo = (item) => {
        if (!item) return { text: '-', icon: faClock, className: 'text-gray-400' };
        
        // Status Pago/Conciliado tem prioridade
        if (item.status === 'Pago' || item.status === 'Conciliado') {
            return { text: 'Pago', icon: faCheckCircle, className: 'text-green-600 bg-green-50 px-2 py-0.5 rounded' };
        }
        
        // Verificação de Atraso
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dataRef = item.data_vencimento || item.data_transacao;
        
        if (dataRef) {
            // Pequeno fix para garantir que a string de data seja interpretada corretamente no fuso local
            const [year, month, day] = dataRef.toString().split('-');
            const dueDate = new Date(year, month - 1, day);
            
            if (dueDate < today && item.status === 'Pendente') {
                return { text: 'Atrasado', icon: faExclamationTriangle, className: 'text-red-600 bg-red-50 px-2 py-0.5 rounded' };
            }
        }

        return { text: 'Pendente', icon: faClock, className: 'text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded' };
    };

    if (!open || !lancamento) return null;

    const statusInfo = getStatusInfo(lancamento);
    const tipoInfo = lancamento.tipo === 'Receita' ? { icon: faArrowUp, className: 'text-green-600' } : { icon: faArrowDown, className: 'text-red-600' };

    return (
        <div className="fixed top-0 right-0 h-full w-full md:w-[500px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col"
             style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}>
            
            <header className="p-4 border-b flex justify-between items-center bg-gray-50">
                <div className='flex-1 overflow-hidden'>
                    <h3 className="text-base font-bold text-gray-800 truncate">{lancamento.descricao}</h3>
                    <p className="text-xs text-gray-500">Detalhes & Auditoria</p>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 ml-4"><FontAwesomeIcon icon={faTimes} /></button>
            </header>
            
            <main className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* --- SEÇÃO DO CÉREBRO DA IA --- */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                        <FontAwesomeIcon icon={faRobot} className="text-indigo-500"/> Auditoria IA
                    </h4>

                    {loadingLog ? (
                        <div className="text-xs text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={faSpinner} spin /> Buscando análise...</div>
                    ) : auditLog ? (
                        <div className="space-y-3 animate-in fade-in duration-500">
                            <div className="flex justify-between items-center">
                                <span className={`text-xs font-bold px-2 py-1 rounded border ${
                                    auditLog.status_auditoria === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' : 
                                    auditLog.status_auditoria === 'Divergente' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                    {auditLog.status_auditoria.toUpperCase()}
                                </span>
                                <span className="text-xs text-gray-500">Confiança: {auditLog.confianca_ia}%</span>
                            </div>

                            <div className="bg-white p-3 rounded border border-slate-200 text-sm text-slate-700 leading-relaxed">
                                <p className="font-semibold text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Análise:</p>
                                {auditLog.analise_ia || "Nenhuma explicação textual fornecida."}
                            </div>

                            {/* Comparativo se houver divergência */}
                            {auditLog.status_auditoria !== 'Aprovado' && (
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-red-50 p-2 rounded border border-red-100">
                                        <p className="text-red-400 font-bold mb-1">Sistema</p>
                                        <p className="text-lg text-red-700 font-mono">{formatCurrency(lancamento.valor)}</p> {/* Usa o valor atualizado */}
                                    </div>
                                    <div className="bg-indigo-50 p-2 rounded border border-indigo-100">
                                        <p className="text-indigo-400 font-bold mb-1">IA Encontrou</p>
                                        <p className="text-lg text-indigo-700 font-mono">{formatCurrency(auditLog.valor_identificado)}</p>
                                    </div>
                                </div>
                            )}

                            {/* BOTÃO DE APROVAÇÃO MANUAL (RESTRICTED) */}
                            {lancamento.status_auditoria_ia !== 'Aprovado' && userProfile?.funcao === 'Proprietário' && (
                                <button onClick={handleAprovarManual} className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white py-2 rounded-md text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2">
                                    <FontAwesomeIcon icon={faCheck} /> Validar Manualmente
                                </button>
                            )}
                            
                            {/* Feedback se não tiver permissão */}
                            {lancamento.status_auditoria_ia !== 'Aprovado' && userProfile?.funcao !== 'Proprietário' && (
                                <p className="text-[10px] text-center text-gray-400 mt-2">
                                    Apenas proprietários podem aprovar divergências manualmente.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-4 bg-white rounded border border-dashed border-gray-300">
                            <p className="text-xs text-gray-400">Ainda não auditado.</p>
                        </div>
                    )}
                </div>

                {/* DADOS CADASTRAIS (AGORA COM EDIÇÃO DE VALOR) */}
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 bg-white rounded-lg">
                    
                    {/* CAMPO DE VALOR EDITÁVEL */}
                    <div className="md:col-span-2">
                        <dt className="text-xs font-semibold text-gray-500 flex items-center gap-2 uppercase">
                            <FontAwesomeIcon icon={faDollarSign} className="w-4" />
                            Valor Lançado
                        </dt>
                        <dd className="mt-1 flex items-center gap-2">
                            {isEditingValue ? (
                                <div className="flex items-center gap-2 w-full">
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        className="border rounded p-1 text-lg font-bold w-40 text-gray-800"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        autoFocus
                                    />
                                    <button 
                                        onClick={handleSaveValue} 
                                        disabled={isSavingValue}
                                        className="text-green-600 hover:bg-green-100 p-2 rounded transition-colors"
                                        title="Salvar correção"
                                    >
                                        <FontAwesomeIcon icon={faSave} />
                                    </button>
                                    <button 
                                        onClick={() => { setIsEditingValue(false); setEditValue(lancamento.valor); }} 
                                        className="text-gray-400 hover:bg-gray-100 p-2 rounded transition-colors"
                                        title="Cancelar"
                                    >
                                        <FontAwesomeIcon icon={faTimes} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className={`text-2xl font-bold ${tipoInfo.className}`}>
                                        {formatCurrency(lancamento.valor)}
                                    </span>
                                    {/* Botão de Edição Rápida */}
                                    <button 
                                        onClick={() => setIsEditingValue(true)} 
                                        className="text-gray-300 hover:text-blue-500 p-1 rounded-full transition-colors text-sm"
                                        title="Corrigir valor"
                                    >
                                        <FontAwesomeIcon icon={faPen} />
                                    </button>
                                </>
                            )}
                        </dd>
                    </div>

                    {/* STATUS AGORA VISÍVEL E COM COR */}
                    <div className="md:col-span-1">
                        <dt className="text-xs font-semibold text-gray-500 flex items-center gap-2 uppercase">
                            <FontAwesomeIcon icon={statusInfo.icon} className="w-4" /> Status
                        </dt>
                        <dd className={`mt-1 text-sm font-bold inline-block ${statusInfo.className}`}>
                            {statusInfo.text}
                        </dd>
                    </div>

                    <InfoField label="Data Vencimento" value={formatDateString(lancamento.data_vencimento)} icon={faCalendarAlt} />
                    
                    {lancamento.data_pagamento && (
                        <InfoField label="Data Pagamento" value={formatDateString(lancamento.data_pagamento)} icon={faCalendarAlt} />
                    )}

                    <InfoField label="Conta" value={lancamento.conta?.nome} icon={faFileInvoice} />
                    <InfoField label="Categoria" value={lancamento.categoria?.nome} icon={faTags} />
                    <div className="md:col-span-2">
                        <InfoField label="Favorecido" value={lancamento.favorecido?.nome || lancamento.favorecido?.razao_social} icon={faUser} />
                    </div>
                    <div className="md:col-span-2">
                        <InfoField label="Observação" value={lancamento.observacao} icon={faStickyNote} />
                    </div>
                </dl>

                {/* ANEXOS */}
                <div className="pt-4 border-t">
                    <AnexosSection anexos={lancamento.anexos} />
                </div>
            </main>
        </div>
    );
}