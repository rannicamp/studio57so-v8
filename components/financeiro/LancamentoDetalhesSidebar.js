"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, faStickyNote, faBuilding, faFileInvoice, faCalendarAlt, faDollarSign, 
    faTags, faUser, faLandmark, faFileLines, faEye, faSpinner, 
    faArrowUp, faArrowDown, faCheckCircle, faExclamationTriangle, faCheck, faClock, faPen, faSave,
    faExpand, faCompress
    // faRobot foi removido daqui! 🗑️
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

const getFileType = (fileName) => {
    const ext = fileName?.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'unknown';
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
const AnexosSection = ({ anexos, onPreview }) => {
    if (!anexos || anexos.length === 0) return <InfoField label="Anexos" value="Nenhum anexo." icon={faFileLines} />;

    return (
        <div>
            <dt className="text-xs font-semibold text-gray-500 flex items-center gap-2 uppercase mb-2">
                <FontAwesomeIcon icon={faFileLines} className="w-4" /> Anexos Disponíveis
            </dt>
            <div className="space-y-2">
                {anexos.map(anexo => (
                    <button 
                        key={anexo.id} 
                        onClick={() => onPreview(anexo)} 
                        className="w-full flex items-center gap-3 p-2 bg-gray-100 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200 text-left text-sm transition-all group"
                    >
                        <div className="bg-white p-1.5 rounded text-blue-500 shadow-sm group-hover:text-blue-600">
                            <FontAwesomeIcon icon={faEye} />
                        </div>
                        <span className="truncate flex-1 font-medium text-gray-700 group-hover:text-blue-800">
                            {anexo.nome_arquivo || 'Documento sem nome'}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">
                            {anexo.nome_arquivo?.split('.').pop() || '?'}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- PAINEL DE VISUALIZAÇÃO DE ARQUIVO ---
const FilePreviewPanel = ({ fileUrl, fileName, fileType, onClose }) => {
    if (!fileUrl) return null;

    return (
        <div 
            className="fixed top-0 right-[500px] h-full bg-gray-900 shadow-2xl z-40 flex flex-col border-r border-gray-700 transform transition-all duration-300 ease-in-out w-full md:w-[calc(100%-500px)] lg:w-[800px]"
        >
            <div className="flex justify-between items-center p-3 bg-gray-800 text-white border-b border-gray-700 shadow-md">
                <h3 className="text-sm font-semibold truncate flex items-center gap-2">
                    <FontAwesomeIcon icon={fileType === 'pdf' ? faFileInvoice : faFileLines} />
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
            
            <div className="flex-1 bg-gray-800 flex items-center justify-center overflow-hidden relative">
                {fileType === 'image' ? (
                    <img src={fileUrl} alt="Preview" className="max-w-full max-h-full object-contain shadow-lg" />
                ) : fileType === 'pdf' ? (
                    <iframe src={`${fileUrl}#toolbar=0`} className="w-full h-full border-none bg-white" title="PDF Preview" />
                ) : (
                    <div className="text-center text-gray-400">
                        <p className="mb-2">Visualização não suportada para este formato.</p>
                        <a href={fileUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Baixar Arquivo</a>
                    </div>
                )}
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

    // Estado do Preview
    const [previewFile, setPreviewFile] = useState(null);

    // --- 1. CARREGAMENTO INICIAL ---
    useEffect(() => {
        if (open && lancamento?.id) {
            fetchAuditLog();
            fetchUserProfile();
            setEditValue(lancamento.valor);
            setPreviewFile(null);
        } else {
            setAuditLog(null);
            setIsEditingValue(false);
            setPreviewFile(null);
        }
    }, [open, lancamento]);

    const fetchUserProfile = async () => {
        if (!user?.id) return;
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

    // --- 2. LÓGICA DE PREVIEW ---
    const handlePreviewAnexo = (anexo) => {
        if (!anexo.caminho_arquivo) return;
        
        const { data } = supabase.storage.from('documentos-financeiro').getPublicUrl(anexo.caminho_arquivo);
        const type = getFileType(anexo.nome_arquivo);
        
        if (data?.publicUrl) {
            setPreviewFile({
                url: data.publicUrl,
                name: anexo.nome_arquivo,
                type: type
            });
        } else {
            toast.error("Erro ao carregar arquivo.");
        }
    };

    // --- 3. LÓGICA DE APROVAÇÃO E EDIÇÃO ---
    const handleAprovarManual = async () => {
        if (!userProfile) return toast.error("Perfil não carregado.");
        if (userProfile.funcao !== 'Proprietário') return toast.error("Apenas Proprietários podem aprovar manualmente.");
        if (!confirm(`Confirmar aprovação manual como ${userProfile.nome}?`)) return;

        try {
            await supabase.from('lancamentos').update({ status_auditoria_ia: 'Aprovado' }).eq('id', lancamento.id);
            await supabase.from('auditoria_ia_logs').insert({
                lancamento_id: lancamento.id,
                organizacao_id: lancamento.organizacao_id || user.user_metadata?.organizacao_id,
                status_auditoria: 'Aprovado',
                analise_ia: `Aprovado manualmente por ${userProfile.nome}.`,
                valor_identificado: lancamento.valor,
                modelo_ia: 'Humano'
            });
            toast.success("Aprovado!");
            onClose(); 
        } catch (e) { toast.error("Erro ao aprovar."); }
    };

    const handleSaveValue = async () => {
        const novoValor = parseFloat(editValue);
        if (isNaN(novoValor) || novoValor <= 0) return toast.error("Valor inválido.");
        setIsSavingValue(true);
        try {
            await supabase.from('lancamentos').update({ valor: novoValor }).eq('id', lancamento.id);
            toast.success("Valor corrigido!");
            setIsEditingValue(false);
            lancamento.valor = novoValor; 
        } catch (e) { toast.error("Erro ao salvar."); } finally { setIsSavingValue(false); }
    };

    // --- 4. RENDERIZAÇÃO ---
    if (!open || !lancamento) return null;

    const statusInfo = (() => {
        if (lancamento.status === 'Pago' || lancamento.status === 'Conciliado') return { text: 'Pago', icon: faCheckCircle, className: 'text-green-600 bg-green-50 px-2 py-0.5 rounded' };
        const today = new Date(); today.setHours(0,0,0,0);
        const dataRef = lancamento.data_vencimento || lancamento.data_transacao;
        if (dataRef && new Date(dataRef) < today) return { text: 'Atrasado', icon: faExclamationTriangle, className: 'text-red-600 bg-red-50 px-2 py-0.5 rounded' };
        return { text: 'Pendente', icon: faClock, className: 'text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded' };
    })();

    const tipoInfo = lancamento.tipo === 'Receita' ? { icon: faArrowUp, className: 'text-green-600' } : { icon: faArrowDown, className: 'text-red-600' };

    return (
        <>
            <div 
                className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            ></div>

            {previewFile && (
                <FilePreviewPanel 
                    fileUrl={previewFile.url} 
                    fileName={previewFile.name} 
                    fileType={previewFile.type} 
                    onClose={() => setPreviewFile(null)} 
                />
            )}

            <div 
                className="fixed top-0 right-0 h-full w-full md:w-[500px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-gray-200"
                style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
            >
                {/* Header */}
                <header className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div className='flex-1 overflow-hidden'>
                        <h3 className="text-base font-bold text-gray-800 truncate" title={lancamento.descricao}>{lancamento.descricao}</h3>
                        <p className="text-xs text-gray-500">Detalhes & Auditoria</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 ml-4 p-2 hover:bg-gray-200 rounded-full transition-colors"><FontAwesomeIcon icon={faTimes} /></button>
                </header>
                
                <main className="flex-1 overflow-y-auto p-5 space-y-6">
                    
                    {/* Auditoria IA (AGORA COM SEU ÍCONE PERSONALIZADO) */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden">
                        {/* 1. Ícone de Fundo (Marca d'água) */}
                        <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                            <img 
                                src="/icons/ia.png" 
                                alt="IA Background" 
                                className="w-16 h-16 object-contain grayscale"
                            />
                        </div>

                        {/* 2. Ícone do Título */}
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3 relative z-10">
                            <img 
                                src="/icons/ia.png" 
                                alt="IA Icon" 
                                className="w-5 h-5 object-contain"
                            />
                            Auditoria IA
                        </h4>

                        {loadingLog ? (
                            <div className="text-xs text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={faSpinner} spin /> Buscando análise...</div>
                        ) : auditLog ? (
                            <div className="space-y-3 relative z-10">
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs font-bold px-2 py-1 rounded border ${
                                        auditLog.status_auditoria === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' : 
                                        auditLog.status_auditoria === 'Divergente' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                        {auditLog.status_auditoria.toUpperCase()}
                                    </span>
                                    <span className="text-xs text-gray-500">Confiança: {auditLog.confianca_ia}%</span>
                                </div>

                                <div className="bg-white p-3 rounded border border-slate-200 text-sm text-slate-700 leading-relaxed max-h-40 overflow-y-auto">
                                    <p className="font-semibold text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Parecer:</p>
                                    {auditLog.analise_ia || "Sem detalhes."}
                                </div>

                                {auditLog.status_auditoria !== 'Aprovado' && (
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="bg-red-50 p-2 rounded border border-red-100">
                                            <p className="text-red-400 font-bold mb-1">Sistema</p>
                                            <p className="text-base text-red-700 font-mono font-bold">{formatCurrency(auditLog.valor_lancamento)}</p>
                                        </div>
                                        <div className="bg-indigo-50 p-2 rounded border border-indigo-100">
                                            <p className="text-indigo-400 font-bold mb-1">IA Leu</p>
                                            <p className="text-base text-indigo-700 font-mono font-bold">{formatCurrency(auditLog.valor_identificado)}</p>
                                        </div>
                                    </div>
                                )}

                                {lancamento.status_auditoria_ia !== 'Aprovado' && userProfile?.funcao === 'Proprietário' && (
                                    <button onClick={handleAprovarManual} className="w-full mt-2 bg-white border border-green-600 text-green-700 hover:bg-green-50 py-2 rounded-md text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2">
                                        <FontAwesomeIcon icon={faCheck} /> Validar Manualmente
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-4 bg-white/50 rounded border border-dashed border-gray-300">
                                <p className="text-xs text-gray-400">Ainda não auditado.</p>
                            </div>
                        )}
                    </div>

                    {/* Dados */}
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 bg-white rounded-lg p-1">
                        <div className="md:col-span-2 pb-2 border-b border-gray-100 mb-2">
                            <dt className="text-xs font-semibold text-gray-500 flex items-center gap-2 uppercase">
                                <FontAwesomeIcon icon={faDollarSign} className="w-4" /> Valor Lançado
                            </dt>
                            <dd className="mt-1 flex items-center gap-2 h-10">
                                {isEditingValue ? (
                                    <div className="flex items-center gap-1 w-full animate-in fade-in slide-in-from-left-2">
                                        <input type="number" step="0.01" className="border-2 border-blue-400 rounded p-1 text-lg font-bold w-full text-gray-800 focus:outline-none" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                                        <button onClick={handleSaveValue} disabled={isSavingValue} className="bg-green-500 text-white p-2 rounded hover:bg-green-600 transition-colors"><FontAwesomeIcon icon={faSave} /></button>
                                        <button onClick={() => { setIsEditingValue(false); setEditValue(lancamento.valor); }} className="bg-gray-200 text-gray-600 p-2 rounded hover:bg-gray-300 transition-colors"><FontAwesomeIcon icon={faTimes} /></button>
                                    </div>
                                ) : (
                                    <>
                                        <span className={`text-3xl font-bold tracking-tight ${tipoInfo.className}`}>{formatCurrency(lancamento.valor)}</span>
                                        <button onClick={() => setIsEditingValue(true)} className="text-gray-300 hover:text-blue-500 p-1.5 rounded-full hover:bg-blue-50 transition-all text-sm ml-2" title="Editar Valor"><FontAwesomeIcon icon={faPen} /></button>
                                    </>
                                )}
                            </dd>
                        </div>

                        <div className="md:col-span-1">
                            <dt className="text-xs font-semibold text-gray-500 flex items-center gap-2 uppercase mb-1">Status</dt>
                            <dd><span className={`text-xs font-bold ${statusInfo.className}`}>{statusInfo.text}</span></dd>
                        </div>

                        <InfoField label="Vencimento" value={formatDateString(lancamento.data_vencimento)} icon={faCalendarAlt} />
                        {lancamento.data_pagamento && <InfoField label="Pagamento" value={formatDateString(lancamento.data_pagamento)} icon={faCheckCircle} />}
                        
                        <div className="md:col-span-2 pt-2 border-t border-gray-100"></div>

                        <InfoField label="Conta" value={lancamento.conta?.nome} icon={faFileInvoice} />
                        <InfoField label="Categoria" value={lancamento.categoria?.nome} icon={faTags} />
                        <div className="md:col-span-2">
                            <InfoField label="Favorecido" value={lancamento.favorecido?.nome || lancamento.favorecido?.razao_social} icon={faUser} />
                        </div>
                        <div className="md:col-span-2 bg-yellow-50 p-2 rounded border border-yellow-100">
                            <InfoField label="Observação" value={lancamento.observacao} icon={faStickyNote} />
                        </div>
                    </dl>

                    {/* Anexos */}
                    <div className="pt-4 border-t border-gray-200">
                        <AnexosSection anexos={lancamento.anexos} onPreview={handlePreviewAnexo} />
                    </div>
                </main>
            </div>
        </>
    );
}