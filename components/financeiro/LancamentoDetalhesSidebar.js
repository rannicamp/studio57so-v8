"use client";

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { addMonths, format, parseISO } from 'date-fns';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
 faTimes, faStickyNote, faBuilding, faFileInvoice, faCalendarAlt, faDollarSign,
 faTags, faUser, faLandmark, faFileLines, faEye, faSpinner,
 faArrowUp, faArrowDown, faCheckCircle, faExclamationTriangle, faCheck, faClock, faPen, faSave,
 faExpand, faCompress, faChevronLeft, faChevronRight, faHardHat
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import GerenciadorAnexosGlobal from '@/components/shared/GerenciadorAnexosGlobal';
import FilePreviewModal from '@/components/shared/FilePreviewModal';

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

// --- COMPONENTE PRINCIPAL ---
export default function LancamentoDetalhesSidebar({ open, onClose, lancamento }) {
 const supabase = createClient();
 const { user } = useAuth();
 const queryClient = useQueryClient();

 // Estados de Dados
 const [auditLog, setAuditLog] = useState(null);
 const [loadingLog, setLoadingLog] = useState(false);
 const [userProfile, setUserProfile] = useState(null);

 // Estados de Edição
 const [isEditingValue, setIsEditingValue] = useState(false);
 const [editValue, setEditValue] = useState('');
 const [isSavingValue, setIsSavingValue] = useState(false);
 const [isChangingDate, setIsChangingDate] = useState(false);

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
 // Garantimos que a URL publica já existe (formatada no carregamento legado)
 let anexoAdaptado = { ...anexo };
 // Se já vier com 'caminho_arquivo' mas não tiver 'public_url', injetamos ela para o Gestor ler (Legado)
 if (anexo.caminho_arquivo && !anexo.public_url) {
 const { data } = supabase.storage.from('documentos-financeiro').getPublicUrl(anexo.caminho_arquivo);
 if (data?.publicUrl) {
 anexoAdaptado.public_url = data.publicUrl;
 }
 }
 setPreviewFile(anexoAdaptado);
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
 if (lancamento.conta_id) {
 queryClient.invalidateQueries({ queryKey: ['faturasCartao', lancamento.conta_id.toString()] });
 }
 } catch (e) { toast.error("Erro ao salvar."); } finally { setIsSavingValue(false); }
 };

  const handleAjustarVencimento = async (mesesAAdicionar) => {
    if (!lancamento || !lancamento.data_vencimento) return toast.error("Data de vencimento não informada.");
    setIsChangingDate(true);
    try {
      const dataVencObj = parseISO(lancamento.data_vencimento);
      const novaDataCalc = addMonths(dataVencObj, mesesAAdicionar);
      const dataVencFormatada = format(novaDataCalc, 'yyyy-MM-dd');

      let novaFaturaId = lancamento.fatura_id;

      // LÓGICA DE REATRIBUIÇÃO (Regra Ticket 115 - Faturas Migrantes)
      if (lancamento.fatura_id && lancamento.conta_id) {
        const mesVencFormated = dataVencFormatada.substring(0, 7); // yyyy-MM
        const orgId = lancamento.organizacao_id;
        
        // 1. Busca a fatura existente no novo mês apontado
        const { data: faturaEncontrada } = await supabase
          .from('faturas_cartao')
          .select('id')
          .eq('conta_id', lancamento.conta_id)
          .eq('mes_referencia', mesVencFormated)
          .maybeSingle();

        if (faturaEncontrada) {
          novaFaturaId = faturaEncontrada.id;
        } else {
          // 2. Se a aba daquela fatura ainda não existe, cria ela "on the fly"
          const { data: novaF } = await supabase
            .from('faturas_cartao')
            .insert({ 
              conta_id: lancamento.conta_id, 
              mes_referencia: mesVencFormated, 
              data_vencimento: dataVencFormatada, 
              organizacao_id: orgId 
            })
            .select('id')
            .maybeSingle();
          if (novaF) novaFaturaId = novaF.id;
        }
      }

      const { error } = await supabase.from('lancamentos').update({ 
        data_vencimento: dataVencFormatada,
        fatura_id: novaFaturaId
      }).eq('id', lancamento.id);
      
      if (error) throw error;

      toast.success("Vencimento e fatura ajustados com sucesso!");
      lancamento.data_vencimento = dataVencFormatada; // update local
      lancamento.fatura_id = novaFaturaId; 
      
      if (lancamento.conta_id) {
        queryClient.invalidateQueries({ queryKey: ['faturasCartao', lancamento.conta_id.toString()] });
        queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
        queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      }
    } catch (e) {
      toast.error("Erro ao alterar vencimento. " + e.message);
    } finally {
      setIsChangingDate(false);
    }
  };

 // --- 4. RENDERIZAÇÃO ---
 if (!open || !lancamento) return null;

 const statusInfo = (() => {
 if (lancamento.status === 'Pago' || lancamento.status === 'Conciliado') return { text: 'Pago', icon: faCheckCircle, className: 'text-green-600 bg-green-50 px-2 py-0.5 rounded' };
 const today = new Date(); today.setHours(0, 0, 0, 0);
 const dataRef = lancamento.data_vencimento || lancamento.data_transacao;
 if (dataRef && new Date(dataRef) < today) return { text: 'Atrasado', icon: faExclamationTriangle, className: 'text-red-600 bg-red-50 px-2 py-0.5 rounded' };
 return { text: 'Pendente', icon: faClock, className: 'text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded' };
 })();

 const tipoInfo = lancamento.tipo === 'Receita' ? { icon: faArrowUp, className: 'text-green-600' } : { icon: faArrowDown, className: 'text-red-600' };

 return (
 <>
 <div
 className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] transition-opacity duration-300 !m-0 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
 onClick={onClose}
 ></div>

 {/* Modal de Pré-Visualização Global Padrão Ouro */}
 <FilePreviewModal anexo={previewFile}
 onClose={() => setPreviewFile(null)}
 />

 <div
 className="fixed top-0 right-0 h-full w-full md:w-[500px] bg-white shadow-2xl z-[100] transform transition-transform duration-300 ease-in-out flex flex-col border-l border-gray-200 !m-0"
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
 <span className={`text-xs font-bold px-2 py-1 rounded border ${auditLog.status_auditoria === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' :
 auditLog.status_auditoria === 'Divergente' ? 'bg-blue-600 text-blue-600 border-blue-600' : 'bg-red-50 text-red-700 border-red-200'
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

 <div className="md:col-span-1">
 <dt className="text-xs font-semibold text-gray-500 flex items-center gap-2 uppercase">
 <FontAwesomeIcon icon={faCalendarAlt} className="w-4" /> Vencimento
 </dt>
 <dd className="mt-1 flex items-center gap-2">
 <span className="text-sm text-gray-800">{formatDateString(lancamento.data_vencimento)}</span>
 <div className="flex bg-gray-100 rounded shadow-sm border overflow-hidden">
 <button
 onClick={() => handleAjustarVencimento(-1)}
 disabled={isChangingDate || isSavingValue}
 className="px-2 py-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors border-r"
 title={lancamento.fatura_id ? "Mover p/ fatura anterior" : "Antecipar 1 mês"}
 >
 {isChangingDate ? <FontAwesomeIcon icon={faSpinner} spin size="xs" /> : <FontAwesomeIcon icon={faChevronLeft} size="xs" />}
 </button>
 <button
 onClick={() => handleAjustarVencimento(1)}
 disabled={isChangingDate || isSavingValue}
 className="px-2 py-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
 title={lancamento.fatura_id ? "Mover p/ próxima fatura" : "Adiar 1 mês"}
 >
 {isChangingDate ? <FontAwesomeIcon icon={faSpinner} spin size="xs" /> : <FontAwesomeIcon icon={faChevronRight} size="xs" />}
 </button>
 </div>
 </dd>
 </div>
 {lancamento.data_pagamento && <InfoField label="Pagamento" value={formatDateString(lancamento.data_pagamento)} icon={faCheckCircle} />}

 <div className="md:col-span-2 pt-2 border-t border-gray-100"></div>

 <InfoField label="Conta" value={lancamento.conta?.nome} icon={faFileInvoice} />
 <InfoField label="Categoria" value={lancamento.categoria?.nome} icon={faTags} />

 {lancamento.data_transacao && (
 <InfoField label="Surgimento (Competência)" value={formatDateString(lancamento.data_transacao)} icon={faCalendarAlt} />
 )}

 {(lancamento.empresa?.nome_fantasia || lancamento.empresa?.razao_social) && (
 <div className="md:col-span-2">
 <InfoField label="Empresa" value={lancamento.empresa?.nome_fantasia || lancamento.empresa?.razao_social} icon={faBuilding} />
 </div>
 )}

 {lancamento.empreendimento?.nome && (
 <div className="md:col-span-2">
 <InfoField
 label="Obra / Centro de Custo"
 value={`${lancamento.empreendimento.nome}${lancamento.etapa?.nome_etapa ? ` - ${lancamento.etapa.nome_etapa}` : ''}`}
 icon={faHardHat}
 />
 </div>
 )}
 <div className="md:col-span-2">
 <InfoField label="Favorecido" value={lancamento.favorecido?.nome || lancamento.favorecido?.razao_social} icon={faUser} />
 </div>
 <div className="md:col-span-2 bg-yellow-50 p-2 rounded border border-yellow-100">
 <InfoField label="Observação" value={lancamento.observacao} icon={faStickyNote} />
 </div>
 </dl>

 {/* Anexos (Componente Global Padrão Ouro) */}
 <div className="pt-4 border-t border-gray-200">
 <dt className="text-xs font-semibold text-gray-500 flex items-center gap-2 uppercase mb-4">
 <FontAwesomeIcon icon={faFileLines} className="w-4" /> Comprovantes e Notas
 </dt>
 <GerenciadorAnexosGlobal anexos={lancamento.anexos?.map(a => ({
 ...a,
 public_url: a.public_url || (typeof a.caminho_arquivo === 'string' && a.caminho_arquivo.startsWith('http') ? a.caminho_arquivo : supabase.storage.from('documentos-financeiro').getPublicUrl(a.caminho_arquivo).data.publicUrl)
 })) || []}
 viewMode="list"
 storageBucket="documentos-financeiro"
 onPreview={handlePreviewAnexo}
 />
 </div>
 </main>
 </div>
 </>
 );
}