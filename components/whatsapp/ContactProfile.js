// components/whatsapp/ContactProfile.js
"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStickyNote, faTasks, faSpinner, faPlus, faPhone, faEnvelope, faIdCard, faGlobe, faPen, faTrash, faCheckCircle, faBullhorn, faUserTie, faCalculator, faExternalLinkAlt,
 faHistory, faTimes, faBriefcase, faSave, faFunnelDollar, faMoneyBillWave,
 faPiggyBank, faBullseye, faCheck, faTimesCircle, faRobot, faSyncAlt, faCopy, faReply, faFolderOpen, faPaperPlane, faFilePdf, faFileImage, faFileVideo, faFileLines,
 faTableCellsLarge, faBars
} from '@fortawesome/free-solid-svg-icons';
import { faInstagram } from '@fortawesome/free-brands-svg-icons';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

// Importa o Formulário Completo
import ContatoForm from '@/components/contatos/ContatoForm';
// Importa o Card do CRM para integração
import ContatoCardCRM from '@/components/crm/ContatoCardCRM';
import AtividadeModal from '@/components/atividades/AtividadeModal';

// --- COMPONENTES AUXILIARES ---

const parseDateFromAiText = (text) => {
  if (!text) return '';
  const lowerText = text.toLowerCase();
  let daysToAdd = 0;
  
  if (lowerText.includes('amanhã') || lowerText.includes('24h') || lowerText.includes('24 horas')) {
    daysToAdd = 1;
  } else if (lowerText.includes('hoje')) {
    daysToAdd = 0;
  } else if (lowerText.includes('48h') || lowerText.includes('48 horas')) {
    daysToAdd = 2;
  } else if (lowerText.includes('72h') || lowerText.includes('72 horas')) {
    daysToAdd = 3;
  } else {
    const match = lowerText.match(/(\d+)\s*dias?/);
    if (match && match[1]) {
      daysToAdd = parseInt(match[1], 10);
    }
  }
  
  const date = new Date();
  if (daysToAdd > 0) {
      date.setDate(date.getDate() + daysToAdd);
  }
  return date.toISOString().split('T')[0];
};

const formatCurrency = (value) => {
 if (value === null || value === undefined || value === '') return null;
 return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Componente de Badge Sim/Não
const BooleanBadge = ({ label, value, icon, trueColor = "bg-green-100 text-green-800", falseColor = "bg-gray-100 text-gray-600" }) => {
 if (value === null || value === undefined) return (
 <div className="flex flex-col">
 <span className="text-xs text-gray-400 mb-1 flex items-center gap-1"><FontAwesomeIcon icon={icon} className="w-3 h-3"/> {label}</span>
 <span className="text-xs italic text-gray-400">Não inf.</span>
 </div>
 );

 const isTrue = String(value) === 'true' || value === true;

 return (
 <div className="flex flex-col">
 <span className="text-xs text-gray-500 mb-1 flex items-center gap-1"><FontAwesomeIcon icon={icon} className="w-3 h-3"/> {label}</span>
 <span className={`text-xs font-bold px-2 py-1 rounded-full border w-fit flex items-center gap-1 ${isTrue ? `${trueColor} border-green-200` : `${falseColor} border-gray-200`}`}>
 {isTrue ? <FontAwesomeIcon icon={faCheck} size="xs"/> : <FontAwesomeIcon icon={faTimesCircle} size="xs"/>}
 {isTrue ? "Sim" : "Não"}
 </span>
 </div>
 );
};

const EditableField = ({ label, value, name, onChange, icon }) => (
 <div className="mb-3">
 <label className="text-xs font-medium text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={icon} className="w-3 h-3"/>{label}</label>
 <input type="text" name={name} value={value || ''} onChange={onChange} className="mt-1 text-sm text-gray-900 w-full p-1 border-b-2 border-gray-200 focus:outline-none focus:border-[#00a884] bg-transparent transition-colors" />
 </div>
);

const EditableSelectBoolean = ({ label, value, name, onChange, icon }) => (
 <div className="mb-3">
 <label className="text-xs font-medium text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={icon} className="w-3 h-3"/>{label}</label>
 <select name={name} value={value === null || value === undefined ? "" : String(value)} onChange={onChange}
 className="mt-1 text-sm text-gray-900 w-full p-1 border-b-2 border-gray-200 focus:outline-none focus:border-[#00a884] bg-transparent transition-colors"
 >
 <option value="">Selecione...</option>
 <option value="true">Sim</option>
 <option value="false">Não</option>
 </select>
 </div>
);

const InfoField = ({ label, value, icon, highlight = false }) => (
 <div className="mb-3">
 <dt className="text-xs font-medium text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={icon} className="w-3 h-3"/>{label}</dt>
 <dd className={`mt-1 text-sm break-words ${highlight ? 'font-bold text-gray-800' : 'font-medium text-gray-900'}`}>
 {value || <span className="text-gray-400 italic font-normal">Não informado</span>}
 </dd>
 </div>
);

// --- ATUALIZADO: Filtra 'objetivo' para não duplicar ---
const MetaFormData = ({ data }) => {
 if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return null;
 const filteredData = { ...data };
 // Remove campos padrão
 delete filteredData.full_name;
 delete filteredData.email;
 delete filteredData.phone_number;

 // Remove campos de OBJETIVO (pois já estão na qualificação)
 Object.keys(filteredData).forEach(key => {
 if (key.toLowerCase().includes('objetivo')) {
 delete filteredData[key];
 }
 });
 if (Object.keys(filteredData).length === 0) return null;

 return (
 <section className="mb-6">
 <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide"><FontAwesomeIcon icon={faBullhorn} /> Dados do Formulário (Meta)</h4>
 <div className="space-y-3 p-3 bg-gray-50 border rounded-md">
 {Object.entries(filteredData).map(([key, value]) => (
 <div key={key}>
 <dt className="text-xs font-medium text-gray-500 capitalize">{key.replace(/_/g, ' ')}</dt>
 <dd className="text-sm text-gray-800 font-medium">{value}</dd>
 </div>
 ))}
 </div>
 </section>
 );
};

const HistoricoTimeline = ({ history }) => {
 if (!history || history.length === 0) {
 return <p className="text-xs text-center text-gray-400 py-4 italic">Nenhuma movimentação registrada.</p>;
 }

 return (
 <div className="flow-root">
 <ul className="-mb-8">
 {history.map((item, itemIdx) => (
 <li key={item.id}>
 <div className="relative pb-8">
 {itemIdx !== history.length - 1 ? (
 <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
 ) : null}
 <div className="relative flex space-x-3">
 <div>
 <span className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center ring-4 ring-white text-gray-500">
 <FontAwesomeIcon icon={faHistory} className="w-3 h-3"/>
 </span>
 </div>
 <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
 <div>
 <p className="text-sm text-gray-600">
 Movido de <strong className="font-medium text-gray-900">{item.coluna_anterior?.nome || 'Início'}</strong> para <strong className="font-medium text-[#00a884]">{item.coluna_nova?.nome}</strong>
 </p>
 <p className="text-xs text-gray-500 mt-1">
 por {item.usuario?.nome || 'Sistema'}
 </p>
 </div>
 <div className="whitespace-nowrap text-right text-[10px] text-gray-400">
 {format(new Date(item.data_movimentacao), 'dd/MM HH:mm')}
 </div>
 </div>
 </div>
 </div>
 </li>
 ))}
 </ul>
 </div>
 );
};

// --- FUNÇÃO DE BUSCA DE DADOS ---
const fetchContactProfileData = async (supabase, contatoId, organizacaoId) => {
 if (!contatoId || !organizacaoId) return null;

 // 1. Dados Cadastrais COMPLETOS (com JOIN em meta_ativos para origem do lead)
 const { data: contactDetails } = await supabase
 .from('contatos')
 .select(`
 *,
 telefones(*),
 emails(*),
 anuncio:meta_ad_id(id, nome),
 adset:meta_adset_id(id, nome),
 campanha:meta_campaign_id(id, nome)
 `) .eq('id', contatoId)
 .single();

 // Resolve os nomes com fallback: coluna _name → JOIN meta_ativos
 if (contactDetails) {
 contactDetails.meta_ad_name = contactDetails.meta_ad_name || contactDetails.anuncio?.nome || null;
 contactDetails.meta_adset_name = contactDetails.meta_adset_name || contactDetails.adset?.nome || null;
 contactDetails.meta_campaign_name = contactDetails.meta_campaign_name || contactDetails.campanha?.nome || null;
 }

 // 2. Dados de Funil (AGORA EXPANDIDO PARA O CARD)
 const { data: funilEntryData } = await supabase
 .from('contatos_no_funil')
 .select(`
 *,
 corretores:corretor_id(id, nome, razao_social),
 produtos_interesse:contatos_no_funil_produtos(
 id,
 produto:produto_id(*)
 )
 `)
 .eq('contato_id', contatoId)
 .maybeSingle();
 if (funilEntryData) {
 funilEntryData.contatos = contactDetails; }

 const funilEntryId = funilEntryData?.id;

 // 3. Informações Relacionadas
 const notesPromise = supabase.from('crm_notas').select('*, usuarios(nome, sobrenome)').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('created_at', { ascending: false });
 const activitiesPromise = supabase.from('activities').select('*').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('data_inicio_prevista', { ascending: true });
 const simulationsPromise = supabase.from('simulacoes').select('id, created_at, status, valor_venda').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('created_at', { ascending: false });
 const historyPromise = funilEntryId ? supabase.from('historico_movimentacao_funil').select('*, coluna_anterior:coluna_anterior_id(nome), coluna_nova:coluna_nova_id(nome), usuario:usuario_id(nome, sobrenome)').eq('contato_no_funil_id', funilEntryId).eq('organizacao_id', organizacaoId).order('data_movimentacao', { ascending: false })
 : Promise.resolve({ data: [] });

 // 4. Verifica se tem Instagram vinculado
 const instagramPromise = supabase
 .from('instagram_conversations')
 .select('participant_username')
 .eq('contato_id', contatoId)
 .not('participant_username', 'is', null)
 .limit(1)
 .maybeSingle();

 const [
 { data: notes }, { data: activities }, { data: simulations }, { data: history },
 { data: instagramData }
 ] = await Promise.all([notesPromise, activitiesPromise, simulationsPromise, historyPromise, instagramPromise]);

 return { contactDetails: contactDetails || {}, funilEntry: funilEntryData,
 funilEntryId, notes: notes || [], activities: activities || [], simulations: simulations || [],
 history: history || [],
 instagramProfile: instagramData || null,
 instagramManual: contactDetails?.instagram_username || null
 };
};

// --- COMPONENTE PRINCIPAL ---
export default function ContactProfile({ contact }) {
 const supabase = createClient();
 const { user } = useAuth();
 const organizacaoId = user?.organizacao_id;
 const queryClient = useQueryClient();
 const notesSectionRef = useRef(null);

 // Estados locais
 const [isEditModalOpen, setIsEditModalOpen] = useState(false); const [isEditingInsta, setIsEditingInsta] = useState(false);
 const [instaInput, setInstaInput] = useState('');
 const [isEditing, setIsEditing] = useState(false); const [editData, setEditData] = useState({});
 const [newNoteContent, setNewNoteContent] = useState('');
 const [editingNoteId, setEditingNoteId] = useState(null);
 const [editingNoteContent, setEditingNoteContent] = useState('');
 const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
 const [activityInitialData, setActivityInitialData] = useState(null);
 const [activeTab, setActiveTab] = useState('resumo');
 const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState('');
 const [arquivosViewMode, setArquivosViewMode] = useState('list');

 const { data: profileData, isLoading } = useQuery({
 queryKey: ['contactProfileData', contact?.contato_id, organizacaoId],
 queryFn: () => fetchContactProfileData(supabase, contact?.contato_id, organizacaoId),
 enabled: !!contact && !!organizacaoId,
 });
 const { data: allColumns = [] } = useQuery({
 queryKey: ['colunasFunil', organizacaoId],
 queryFn: async () => {
 const { data } = await supabase.from('colunas_funil').select('*').eq('organizacao_id', organizacaoId).order('ordem');
 return data || [];
 },
 enabled: !!organizacaoId
 });

 const { data: availableProducts = [] } = useQuery({
 queryKey: ['produtosDisponiveis', organizacaoId],
 queryFn: async () => {
 const { data } = await supabase.from('produtos_empreendimento').select('*').eq('organizacao_id', organizacaoId).eq('status', 'Disponível');
 return data || [];
 },
 enabled: !!organizacaoId
 });

 const { data: empreendimentos = [] } = useQuery({
 queryKey: ['empreendimentos', organizacaoId],
 queryFn: async () => {
 const { data } = await supabase.from('empreendimentos').select('id, nome').eq('organizacao_id', organizacaoId).order('nome');
 return data || [];
 },
 enabled: !!organizacaoId
 });

 const { data: anexosCorretor = [], isLoading: isLoadingAnexos } = useQuery({
 queryKey: ['anexosCorretor', selectedEmpreendimentoId],
 queryFn: async () => {
 const { data, error } = await supabase.from('empreendimento_anexos')
 .select('id, nome_arquivo, caminho_arquivo, descricao, thumbnail_url, tipo:documento_tipos(descricao)')
 .eq('empreendimento_id', selectedEmpreendimentoId)
 .eq('disponivel_corretor', true);
 
 if (error) {
   console.error("Erro ao buscar anexos:", error);
   return [];
 }

 const anexosComUrl = (data || []).map((anexo) => {
   const { data: urlData } = supabase.storage
     .from('empreendimento-anexos')
     .getPublicUrl(anexo.caminho_arquivo);
   return { ...anexo, public_url: urlData?.publicUrl };
 });

 return anexosComUrl;
 },
 enabled: !!selectedEmpreendimentoId
 });

 const { notes = [], activities = [], simulations = [], history = [], funilEntry, contactDetails, funilEntryId, instagramProfile, instagramManual } = profileData || {};
 const displayContact = { ...contact, ...contactDetails };

 useEffect(() => {
 if (funilEntry?.empreendimento_id && !selectedEmpreendimentoId) {
 setSelectedEmpreendimentoId(funilEntry.empreendimento_id);
 }
 }, [funilEntry?.empreendimento_id]);

 useEffect(() => {
 if (displayContact) {
 setEditData({
 nome: displayContact.nome || '',
 razao_social: displayContact.razao_social || '',
 telefone: displayContact.telefone || displayContact.phone_number || '',
 email: displayContact.email || '',
 cpf: displayContact.cpf || '',
 cnpj: displayContact.cnpj || '',
 origem: displayContact.origem || '',
 cargo: displayContact.cargo || '',
 renda_familiar: displayContact.renda_familiar ? formatCurrency(displayContact.renda_familiar) : '',
 fgts: displayContact.fgts,
 mais_de_3_anos_clt: displayContact.mais_de_3_anos_clt,
 objetivo: displayContact.objetivo || ''
 });
 }
 }, [contact?.contato_id, profileData]);

 // --- MUTAÇÕES GERAIS ---
 const sendDirectAttachmentMutation = useMutation({
 mutationFn: async (anexo) => {
 const rawPhone = displayContact?.phone_number || displayContact?.telefone;
 if (!rawPhone) throw new Error("Número do destinatário não encontrado.");
 const targetPhone = rawPhone.replace(/[^0-9]/g, '');

 let fileType = 'document';
 const ext = (anexo.caminho_arquivo || anexo.nome_arquivo || '').split('.').pop().toLowerCase();
 if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) fileType = 'video';
 if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) fileType = 'image';

 const response = await fetch('/api/whatsapp/send', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 to: targetPhone, type: fileType, link: anexo.public_url, filename: anexo.nome_arquivo, caption: '',
 contact_id: displayContact.contato_id || contact?.contato_id, organizacao_id: organizacaoId
 }),
 });
 const apiResult = await response.json();
 if (!response.ok) throw new Error(apiResult.error || 'Erro ao enviar o arquivo.');
 return apiResult;
 },
 onSuccess: () => {
 toast.success("Arquivo enviado com sucesso!");
 queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact?.contato_id] });
 },
 onError: (e) => toast.error(`Erro ao enviar: ${e.message}`)
 });

 const saveContactMutation = useMutation({
 mutationFn: async (updatedData) => {
 const { nome, razao_social, cpf, cnpj, origem, telefone, email, cargo, renda_familiar, fgts, mais_de_3_anos_clt, objetivo } = updatedData;
 // CORREÇÃO AQUI: Limpeza da Renda Familiar (IGUAL AO CONTATO FORM)
 let rendaFinal = null;
 if (renda_familiar) {
 // Garante que é string para manipular
 const strVal = String(renda_familiar);
 // 1. Remove tudo que NÃO for número ou vírgula
 const cleanString = strVal.replace(/[^\d,]/g, '');
 // 2. Troca vírgula por ponto (padrão americano do banco)
 const numberString = cleanString.replace(',', '.');
 // 3. Converte
 rendaFinal = parseFloat(numberString);
 if (isNaN(rendaFinal)) rendaFinal = null;
 } else if (renda_familiar === '') {
 rendaFinal = null;
 }
 // Tratamento Booleans Select
 const parseBoolean = (val) => val === 'true' || val === true ? true : (val === 'false' || val === false ? false : null);

 const { error } = await supabase.from('contatos').update({ nome, razao_social, cpf, cnpj, origem, cargo, objetivo,
 renda_familiar: rendaFinal,
 fgts: parseBoolean(fgts),
 mais_de_3_anos_clt: parseBoolean(mais_de_3_anos_clt)
 }).eq('id', contact.contato_id);
 if (error) throw error;

 if (telefone) await supabase.from('telefones').upsert({ contato_id: contact.contato_id, telefone, tipo: 'Principal', organizacao_id: organizacaoId }, { onConflict: 'contato_id, telefone' });
 if (email) await supabase.from('emails').upsert({ contato_id: contact.contato_id, email, tipo: 'Principal', organizacao_id: organizacaoId }, { onConflict: 'contato_id, email' });
 },
 onSuccess: () => {
 setIsEditing(false);
 queryClient.invalidateQueries({ queryKey: ['contactProfileData', contact.contato_id] });
 queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
 toast.success("Contato atualizado!");
 },
 onError: (e) => toast.error("Erro ao salvar: " + e.message)
 });

 const addNoteMutation = useMutation({
 mutationFn: async (noteContent) => {
 if (!funilEntryId) throw new Error("Contato precisa estar em um funil para receber notas (CRM).");
 await supabase.from('crm_notas').insert({ contato_id: contact.contato_id, contato_no_funil_id: funilEntryId, conteudo: noteContent, usuario_id: user.id, organizacao_id: organizacaoId }).throwOnError();
 },
 onSuccess: () => {
 setNewNoteContent('');
 queryClient.invalidateQueries({ queryKey: ['contactProfileData', contact.contato_id] });
 toast.success("Nota adicionada!");
 },
 onError: (e) => toast.error(e.message)
 });

 const crudMutation = useMutation({
 mutationFn: async ({ action, table, data, id }) => {
 if (action === 'update') await supabase.from(table).update(data).eq('id', id).throwOnError();
 else if (action === 'delete') await supabase.from(table).delete().eq('id', id).throwOnError();
 },
 onSuccess: () => {
 setEditingNoteId(null);
 queryClient.invalidateQueries({ queryKey: ['contactProfileData', contact.contato_id] });
 toast.success("Operação realizada.");
 }
 });

 // --- MUTAÇÕES DO CARD CRM ---

 const moveCardMutation = useMutation({
 mutationFn: async ({ cardId, newColumnId }) => {
 await supabase.from('contatos_no_funil').update({ coluna_id: newColumnId, updated_at: new Date() }).eq('id', cardId).throwOnError();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['contactProfileData', contact.contato_id] });
 toast.success("Card movido!");
 }
 });

 const associateProductMutation = useMutation({
 mutationFn: async ({ cardId, productId }) => {
 await supabase.from('contatos_no_funil_produtos').insert({ contato_no_funil_id: cardId, produto_id: productId, organizacao_id: organizacaoId }).throwOnError();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['contactProfileData', contact.contato_id] });
 toast.success("Unidade associada!");
 }
 });

 const dissociateProductMutation = useMutation({
 mutationFn: async (itemId) => {
 await supabase.from('contatos_no_funil_produtos').delete().eq('id', itemId).throwOnError();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['contactProfileData', contact.contato_id] });
 toast.success("Unidade removida.");
 }
 });

 const associateCorretorMutation = useMutation({
 mutationFn: async ({ cardId, corretorId }) => {
 await supabase.from('contatos_no_funil').update({ corretor_id: corretorId }).eq('id', cardId).throwOnError();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['contactProfileData', contact.contato_id] });
 toast.success("Corretor atualizado.");
 }
 });

 const deleteCardMutation = useMutation({
 mutationFn: async (cardId) => {
 await supabase.from('contatos_no_funil').delete().eq('id', cardId).throwOnError();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['contactProfileData', contact.contato_id] });
 toast.success("Card excluído do funil.");
 }
 });

 // --- HANDLERS ---
 const handleSaveNoteEdit = (noteId) => crudMutation.mutate({ action: 'update', table: 'crm_notas', data: { conteudo: editingNoteContent }, id: noteId });
 const createDeleteHandler = (itemType, itemId) => { if(confirm("Tem certeza que deseja excluir?")) crudMutation.mutate({ action: 'delete', table: itemType, id: itemId }); };
 const handleSaveSuccessModal = () => { setIsEditModalOpen(false); queryClient.invalidateQueries({ queryKey: ['contactProfileData', contact.contato_id] }); queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] }); };

 // Salvar o Instagram Manual do Usuário
 const handleSaveInstagram = () => {
 let cleanUsername = instaInput.trim();
 if (cleanUsername.startsWith('@')) cleanUsername = cleanUsername.substring(1); // remove o @
 crudMutation.mutate({ action: 'update', table: 'contatos', id: contact.contato_id, data: { instagram_username: cleanUsername } });
 setIsEditingInsta(false);
 };

  // --- AI ANALYSIS MUTATION ---
  const aiAnalysisMutation = useMutation({
    mutationFn: async (forceUpdate = false) => {
      const response = await fetch('/api/ai/chat-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contato_id: contact.contato_id,
          organizacao_id: organizacaoId,
          force: forceUpdate
        })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao gerar análise');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactProfileData', contact.contato_id] });
      toast.success("Análise de IA concluída!");
    },
    onError: (e) => toast.error(e.message)
  });

  if (!contact) return <div className="p-4 text-center text-sm text-gray-500">Selecione uma conversa.</div>;
 if (isLoading) return <div className="p-8 text-center text-gray-500"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-2 text-[#00a884]"/><p>Carregando perfil...</p></div>;

 return (
 <div className="flex flex-col h-full bg-white border-l border-gray-200">
 {/* Cabeçalho Fixo - Compacto Executivo */}
 <div className="flex items-center justify-between p-4 border-b bg-gray-50/50">
   <div className="flex items-center gap-3">
     <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-xl font-bold text-white overflow-hidden shadow-sm border-2 border-white flex-shrink-0">
     {displayContact.foto_url ? (
       <img src={displayContact.foto_url} alt="" className="w-full h-full object-cover" />
     ) : (
       (displayContact.nome || '?').charAt(0).toUpperCase()
     )}
     </div>
     <div className="flex flex-col">
       <h3 className="text-sm font-bold text-gray-900 leading-tight truncate max-w-[200px]" title={displayContact.nome}>{displayContact.nome}</h3>
       <p className="text-xs text-gray-500 font-medium mt-0.5">{displayContact.telefone || displayContact.phone_number}</p>
     </div>
   </div>

   <div className="flex gap-2">
     {/* Botão Bonito se tiver Instagram */}
     {(!isEditingInsta && (instagramProfile?.participant_username || instagramManual)) ? (
       <div className="relative group">
         <a
         href={`https://www.instagram.com/${instagramProfile?.participant_username || instagramManual}/`}
         target="_blank"
         rel="noopener noreferrer"
         title={`@${instagramProfile?.participant_username || instagramManual}`}
         className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm hover:shadow-md transition-all"
         style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}
         >
         <FontAwesomeIcon icon={faInstagram} className="text-sm" />
         </a>
         {!instagramProfile?.participant_username && instagramManual && (
         <button
         onClick={() => {
         setInstaInput(instagramManual);
         setIsEditingInsta(true);
         }}
         className="absolute -right-1 -top-1 bg-white border border-gray-200 text-gray-500 hover:text-blue-600 rounded-full w-4 h-4 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
         >
         <FontAwesomeIcon icon={faPen} className="text-[8px]" />
         </button>
         )}
       </div>
     ) : (
       /* Busca Semi-Automática se NÃO tiver instagram */
       <div className="flex gap-1 relative group">
         <a
         href={`https://www.google.com/search?q=site:instagram.com+"${encodeURIComponent(displayContact.nome || '')}"`}
         target="_blank"
         rel="noopener noreferrer"
         title="Buscar Instagram no Google"
         className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-400 hover:text-[#fd1d1d] hover:bg-gray-200 transition-colors shadow-sm"
         >
         <FontAwesomeIcon icon={faInstagram} className="text-sm" />
         </a>
         <button
         onClick={() => setIsEditingInsta(true)}
         title="Inserir @ manualmente"
         className="absolute -right-1 -top-1 bg-white border border-gray-200 text-gray-500 hover:text-blue-600 rounded-full w-4 h-4 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
         >
         <FontAwesomeIcon icon={faPen} className="text-[8px]"/>
         </button>
       </div>
     )}

     {/* Edição Rápida de Insta */}
     {isEditingInsta && (
       <div className="absolute top-16 right-4 z-50 bg-white p-2 rounded-lg shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 flex flex-col gap-2">
         <div className="flex items-center w-full shadow-sm">
         <span className="bg-gray-100 border border-gray-300 border-r-0 rounded-l px-2 py-1 text-xs font-bold text-gray-500">@</span>
         <input
         type="text"
         placeholder="usuario.do.insta"
         className="flex-1 border border-gray-300 px-2 py-1 text-xs text-gray-700 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 font-medium"
         value={instaInput}
         onChange={(e) => setInstaInput(e.target.value)}
         onKeyDown={(e) => e.key === 'Enter' && handleSaveInstagram()}
         autoFocus
         />
         <button
         onClick={handleSaveInstagram}
         className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded-r border border-purple-600 transition-colors"
         >
         <FontAwesomeIcon icon={faCheck} className="text-[10px]" />
         </button>
         </div>
       </div>
     )}
   </div>
 </div>

  {/* --- ABAS GLOBAIS NO TOPO --- */}
  <div className="flex border-b border-gray-200 bg-white overflow-x-auto custom-scrollbar shrink-0">
    <button onClick={() => setActiveTab('resumo')} title="Resumo" className={`flex-1 py-3 text-base transition-colors ${activeTab === 'resumo' ? 'border-b-2 border-blue-600 text-blue-700 bg-gray-50' : 'border-b-2 border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}>
      <FontAwesomeIcon icon={faIdCard} />
    </button>
    <button onClick={() => setActiveTab('notas')} title="Notas" className={`flex-1 py-3 text-base transition-colors ${activeTab === 'notas' ? 'border-b-2 border-purple-600 text-purple-700 bg-gray-50' : 'border-b-2 border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}>
      <FontAwesomeIcon icon={faStickyNote} />
    </button>
    <button onClick={() => setActiveTab('atividades')} title="Atividades" className={`flex-1 py-3 text-base transition-colors ${activeTab === 'atividades' ? 'border-b-2 border-blue-600 text-blue-700 bg-gray-50' : 'border-b-2 border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}>
      <FontAwesomeIcon icon={faTasks} />
    </button>
    <button onClick={() => setActiveTab('simulacoes')} title="Simulações" className={`flex-1 py-3 text-base transition-colors ${activeTab === 'simulacoes' ? 'border-b-2 border-[#00a884] text-[#00a884] bg-gray-50' : 'border-b-2 border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}>
      <FontAwesomeIcon icon={faCalculator} />
    </button>
    <button onClick={() => setActiveTab('historico')} title="Histórico" className={`flex-1 py-3 text-base transition-colors ${activeTab === 'historico' ? 'border-b-2 border-gray-800 text-gray-900 bg-gray-50' : 'border-b-2 border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}>
      <FontAwesomeIcon icon={faHistory} />
    </button>
    <button onClick={() => setActiveTab('arquivos')} title="Arquivos" className={`flex-1 py-3 text-base transition-colors ${activeTab === 'arquivos' ? 'border-b-2 border-gray-800 text-gray-900 bg-gray-50' : 'border-b-2 border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}>
      <FontAwesomeIcon icon={faFolderOpen} />
    </button>
  </div>

  <main className="flex-1 overflow-y-auto p-5 space-y-0 custom-scrollbar bg-white">
    {activeTab === 'resumo' && (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* --- NOVA SEÇÃO: ANÁLISE IA --- */}
        <section className="pb-5 border-b border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold text-gray-500 text-[11px] uppercase tracking-wider flex items-center gap-2">
              <FontAwesomeIcon icon={faRobot} className="text-purple-400" /> Análise IA
            </h4>
            <button 
              onClick={() => aiAnalysisMutation.mutate(true)}
              disabled={aiAnalysisMutation.isPending}
              className="text-[10px] text-purple-600 hover:text-purple-800 font-bold uppercase transition-colors flex items-center gap-1.5"
              title="Ler conversas e analisar lead com Gemini 3.1 Pro"
            >
              <FontAwesomeIcon icon={aiAnalysisMutation.isPending ? faSpinner : faSyncAlt} spin={aiAnalysisMutation.isPending} /> 
              {displayContact.ai_analysis ? 'Atualizar' : 'Gerar Análise'}
            </button>
          </div>
          
          <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-200 to-transparent rounded-full opacity-20 -mr-10 -mt-10 pointer-events-none"></div>
            
            {aiAnalysisMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-6 text-purple-500">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-3" />
                <p className="text-xs font-medium animate-pulse text-purple-600">Lendo histórico e cruzando com CRM...</p>
              </div>
            ) : displayContact.ai_analysis ? (
              <div className="space-y-4 relative z-10">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-sm ${
                      displayContact.ai_analysis.temperatura === 'Quente' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                      displayContact.ai_analysis.temperatura === 'Morno' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                      'bg-blue-100 text-blue-700 border-blue-200'
                    }`}>
                    {displayContact.ai_analysis.temperatura === 'Quente' ? '🔥 Quente' :
                     displayContact.ai_analysis.temperatura === 'Morno' ? '😐 Morno' : '🧊 Frio'}
                  </span>
                  {displayContact.ai_analysis.last_updated && (
                     <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                       <FontAwesomeIcon icon={faSyncAlt} className="mr-1 opacity-60" />
                       Atualizado em {format(new Date(displayContact.ai_analysis.last_updated), "dd/MM 'às' HH:mm")}
                     </span>
                  )}
                </div>
                
                <div>
                  <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faStickyNote} className="text-gray-400" /> Diagnóstico
                  </h5>
                  <p className="text-xs text-gray-800 font-medium leading-relaxed bg-white/70 p-2.5 rounded-lg border border-purple-50 shadow-sm align-middle whitespace-pre-wrap">
                    {displayContact.ai_analysis.resumo_interacao}
                  </p>
                </div>
                
                <div>
                  <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 mt-0.5">
                     <FontAwesomeIcon icon={faCheckCircle} className="text-gray-400"/> Próximo Passo
                  </h5>
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs p-3 rounded-lg font-medium shadow-sm flex flex-col gap-3">
                    <div className="flex items-start gap-2.5">
                      <FontAwesomeIcon icon={faRobot} className="mt-0.5 opacity-90 text-sm shrink-0" />
                      <p className="leading-snug">{displayContact.ai_analysis.proxima_acao_sugerida}</p>
                    </div>
                    <button
                      onClick={() => {
                        setActivityInitialData({
                          nome: `Ação Sugerida: ${displayContact.nome}`,
                          descricao: displayContact.ai_analysis.proxima_acao_sugerida,
                          contato_id: contact.contato_id,
                          funcionario_id: user?.funcionario_id || null,
                          data_inicio_prevista: parseDateFromAiText(displayContact.ai_analysis.proxima_acao_sugerida)
                        });
                        setIsActivityModalOpen(true);
                      }}
                      className="bg-white/20 hover:bg-white/30 text-white text-[10px] px-3 py-2 rounded uppercase tracking-wider font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 w-full mt-1"
                      title="Criar atividade"
                    >
                      <FontAwesomeIcon icon={faTasks} /> Transformar em Atividade
                    </button>
                  </div>
                </div>
                
                {/* BLOCO DE RESPOSTA SUGERIDA */}
                {displayContact.ai_analysis.proxima_resposta_sugerida && (
                  <div className="mt-4 pt-4 border-t border-purple-100/50">
                    <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                       <FontAwesomeIcon icon={faReply} className="text-gray-400"/> Resposta Sugerida
                    </h5>
                    <div className="bg-white text-gray-800 text-xs p-3 rounded-lg font-medium shadow-sm flex flex-col gap-3 border border-purple-100 relative">
                      <div className="flex items-start gap-2.5">
                        <p className="leading-relaxed whitespace-pre-wrap flex-1">{displayContact.ai_analysis.proxima_resposta_sugerida}</p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(displayContact.ai_analysis.proxima_resposta_sugerida);
                          toast.success("Resposta copiada para a área de transferência!");
                        }}
                        className="bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] px-3 py-2 rounded uppercase tracking-wider font-bold transition-colors flex items-center justify-center gap-1.5 w-full mt-1 border border-purple-200"
                        title="Copiar resposta"
                      >
                        <FontAwesomeIcon icon={faCopy} /> Copiar para Envio
                      </button>
                      <p className="text-[9px] text-gray-400 text-center italic mt-1 leading-tight">
                        A IA formulou esta resposta baseada nos dados públicos e anexos do empreendimento vinculado a este lead.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-white/40 rounded-lg">
                <FontAwesomeIcon icon={faRobot} className="text-purple-200 text-4xl mb-3" />
                <p className="text-xs text-gray-500 max-w-xs mx-auto font-medium">
                  IA Inativa. Clique no botão "Gerar Análise" para ler a conversa e diagnosticar este lead.
                </p>
              </div>
            )}
          </div>
        </section>

        {funilEntry && (
          <section className="pb-5 border-b border-gray-100">
            <h4 className="font-semibold text-gray-500 text-[11px] uppercase tracking-wider flex items-center gap-2 mb-3">
              <FontAwesomeIcon icon={faFunnelDollar} className="text-[#00a884]" /> Gestão do Funil
            </h4>
            <div className="flex flex-col gap-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                Mover Lead para a Fase
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg pl-3 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-[#00a884] focus:border-[#00a884] transition-shadow disabled:opacity-50 cursor-pointer"
                  value={funilEntry.coluna_id}
                  onChange={(e) => {
                    const newColId = parseInt(e.target.value);
                    if (newColId !== funilEntry.coluna_id) {
                      moveCardMutation.mutate({ cardId: funilEntry.id, newColumnId: newColId });
                    }
                  }}
                  disabled={moveCardMutation.isPending}
                >
                  {allColumns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.nome}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  {moveCardMutation.isPending ? (
                    <FontAwesomeIcon icon={faSpinner} spin className="text-[10px] text-[#00a884]" />
                  ) : (
                    <span className="text-[10px]">▼</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* --- NOVA SEÇÃO: RAIO-X DO CLIENTE (Qualificação + Dados Pessoais unificados) --- */}
  <section className="pb-5 border-b border-gray-100">
  <div className="flex justify-between items-center mb-3">
  <h4 className="font-semibold text-gray-500 text-[11px] uppercase tracking-wider flex items-center gap-2">
  <FontAwesomeIcon icon={faIdCard} className="text-gray-400" /> Raio-X do Cliente
  </h4>
  {/* BOTÕES DE AÇÃO GLOBAIS (Edit/Save) */}
  {isEditing ? (
  <div className="flex items-center gap-2">
  <button onClick={() => setIsEditing(false)} className="text-[10px] uppercase font-bold text-gray-500 hover:text-gray-700 px-2 py-1">Cancelar</button>
  <button onClick={() => saveContactMutation.mutate(editData)} disabled={saveContactMutation.isPending} className="text-[10px] uppercase font-bold bg-[#00a884] text-white px-3 py-1 rounded hover:bg-[#008f6f] transition-colors">
  {saveContactMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin/> : <FontAwesomeIcon icon={faSave} />} Salvar
  </button>
  </div>
  ) : (
  <div className="flex items-center gap-1">
  <button onClick={() => setIsEditing(true)} className="text-[10px] uppercase font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors" title="Edição Rápida">
  <FontAwesomeIcon icon={faPen}/> Editar
  </button>
  <button onClick={() => setIsEditModalOpen(true)} className="text-[10px] uppercase font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-2 py-1 rounded transition-colors" title="Ficha Completa">
  <FontAwesomeIcon icon={faExternalLinkAlt}/> Completo
  </button>
  </div>
  )}
  </div>

  <div className={`grid grid-cols-2 gap-x-4 gap-y-3 ${isEditing ? 'p-3 bg-blue-50/30 rounded-lg' : ''}`}>
  {isEditing ? (
  <>
  <div className="col-span-2">
  <EditableField label="Objetivo / Interesse" value={editData.objetivo} name="objetivo" onChange={(e) => setEditData({ ...editData, objetivo: e.target.value })} icon={faBullseye} />
  </div>
  <EditableField label="Profissão/Cargo" value={editData.cargo} name="cargo" onChange={(e) => setEditData({ ...editData, cargo: e.target.value })} icon={faBriefcase} />
  <EditableField label="Renda Familiar" value={editData.renda_familiar} name="renda_familiar" onChange={(e) => setEditData({ ...editData, renda_familiar: e.target.value })} icon={faMoneyBillWave} />
  <EditableSelectBoolean label="Possui FGTS?" value={editData.fgts} name="fgts" onChange={(e) => setEditData({ ...editData, fgts: e.target.value })} icon={faPiggyBank} />
  <EditableSelectBoolean label="+3 Anos CLT?" value={editData.mais_de_3_anos_clt} name="mais_de_3_anos_clt" onChange={(e) => setEditData({ ...editData, mais_de_3_anos_clt: e.target.value })} icon={faBriefcase} />
  <div className="col-span-2 pt-2 border-t border-blue-100 mt-1">
  <h5 className="text-[10px] font-bold text-blue-400 uppercase mb-2">Dados Básicos</h5>
  </div>
  <EditableField label="CPF/CNPJ" value={editData.cpf || editData.cnpj} name={displayContact.personalidade_juridica === 'Pessoa Física' ? 'cpf' : 'cnpj'} onChange={(e) => setEditData({ ...editData, [e.target.name]: e.target.value })} icon={faIdCard} />
  <EditableField label="Email" value={editData.email} name="email" onChange={(e) => setEditData({ ...editData, email: e.target.value })} icon={faEnvelope} />
  </>
  ) : (
  <>
  <div className="col-span-2">
  <InfoField label="Objetivo / Interesse" value={displayContact.objetivo} icon={faBullseye} highlight={true} />
  </div>
  <InfoField label="Profissão" value={displayContact.cargo} icon={faUserTie} />
  <InfoField label="Renda Familiar" value={formatCurrency(displayContact.renda_familiar)} icon={faMoneyBillWave} highlight={displayContact.renda_familiar} />
  <BooleanBadge label="Possui FGTS?" value={displayContact.fgts} icon={faPiggyBank} />
  <BooleanBadge label="+3 Anos CLT?" value={displayContact.mais_de_3_anos_clt} icon={faBriefcase} trueColor="bg-blue-100 text-blue-800" />
  <InfoField label="CPF/CNPJ" value={displayContact.cpf || displayContact.cnpj} icon={faIdCard} />
  <InfoField label="Email" value={displayContact.email} icon={faEnvelope} />
  </>
  )}
  </div>
  </section>

  {/* --- SEÇÃO: INTELIGÊNCIA DE TRÁFEGO --- */}
  {(displayContact.origem || displayContact.meta_campaign_name || displayContact.meta_ad_name || (displayContact.meta_form_data && Object.keys(displayContact.meta_form_data).length > 0)) && (
  <section className="pb-5 border-b border-gray-100 last:border-0">
  <div className="flex items-center mb-3">
  <h4 className="font-semibold text-gray-500 text-[11px] uppercase tracking-wider flex items-center gap-2">
  <FontAwesomeIcon icon={faBullhorn} className="text-blue-400" /> Inteligência de Tráfego
  </h4>
  </div>
  <div className="space-y-3">
  {displayContact.origem && (
  <div>
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${displayContact.origem === 'Meta Lead Ad' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
  <FontAwesomeIcon icon={displayContact.origem === 'Meta Lead Ad' ? faBullhorn : faGlobe} />
  {displayContact.origem}
  </span>
  </div>
  )}

  {displayContact.origem === 'Meta Lead Ad' && (displayContact.meta_campaign_name || displayContact.meta_adset_name) && (
  <div className="grid grid-cols-1 gap-2 bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs">
  {displayContact.meta_campaign_name && <p className="text-gray-600"><strong className="text-gray-800">Campanha:</strong> {displayContact.meta_campaign_name}</p>}
  {displayContact.meta_adset_name && <p className="text-gray-600"><strong className="text-gray-800">Conjunto:</strong> {displayContact.meta_adset_name}</p>}
  {displayContact.meta_ad_name && <p className="text-gray-600"><strong className="text-gray-800">Anúncio:</strong> {displayContact.meta_ad_name}</p>}
  {displayContact.meta_created_time && (
  <p className="text-gray-400 text-[10px] mt-1 pt-2 border-t border-gray-200">
  Capturado em: {format(new Date(displayContact.meta_created_time), "dd/MM/yyyy 'às' HH:mm")}
  </p>
  )}
  </div>
  )}
  </div>
  </section>
  )}

  <MetaFormData data={displayContact.meta_form_data} />

      </div>
    )}

    {/* TAB: NOTAS */}
    {activeTab === 'notas' && (
       <div ref={notesSectionRef} className="space-y-4 animate-in fade-in duration-200">
         {funilEntryId ? (
         <div className="relative">
         <textarea value={newNoteContent} onChange={(e) => setNewNoteContent(e.target.value)} placeholder="Escreva uma nova nota rápida..." className="w-full p-3 border border-yellow-200 rounded-lg text-sm bg-yellow-50 focus:bg-white transition-colors focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none resize-none shadow-sm" rows={2}
         ></textarea>
         <button onClick={() => addNoteMutation.mutate(newNoteContent)} disabled={addNoteMutation.isPending || !newNoteContent.trim()} className="absolute bottom-3 right-3 text-gray-400 hover:text-[#00a884] disabled:opacity-50 transition-colors bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-sm border border-gray-100" title="Salvar Nota"
         >
         {addNoteMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} />}
         </button>
         </div>
         ) : (
         <div className="text-xs text-center text-gray-400 bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200">Contato fora do funil. Notas indisponíveis.</div>
         )}

         <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
         {notes.length > 0 ? notes.map(note => (
         <div key={note.id} className="bg-yellow-50/50 p-3 rounded-lg border border-yellow-100 text-sm group relative hover:shadow-sm transition-shadow">
         {editingNoteId === note.id ? (
         <div>
         <textarea value={editingNoteContent} onChange={(e) => setEditingNoteContent(e.target.value)} className="w-full p-2 border rounded-md text-xs bg-white focus:ring-1 focus:ring-blue-400 outline-none" rows={3}/>
         <div className="flex justify-end gap-2 mt-2">
         <button onClick={() => setEditingNoteId(null)} className="text-[10px] uppercase font-bold text-gray-500">Cancelar</button>
         <button onClick={() => handleSaveNoteEdit(note.id)} className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Salvar</button>
         </div>
         </div>
         ) : (
         <>
         <p className="text-gray-800 whitespace-pre-wrap text-xs leading-relaxed">{note.conteudo}</p>
         <div className="flex justify-between items-end mt-3 pt-2 border-t border-yellow-100/50">
         <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">{note.usuarios?.nome} • {format(new Date(note.created_at), 'dd/MM/yy HH:mm')}</p>
         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow-sm border border-yellow-100 absolute bottom-2 right-2">
         <button onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.conteudo); }} className="text-gray-400 hover:text-blue-600" title="Editar"><FontAwesomeIcon icon={faPen} size="xs"/></button>
         <button onClick={() => createDeleteHandler('crm_notas', note.id)} className="text-gray-400 hover:text-red-600" title="Excluir"><FontAwesomeIcon icon={faTrash} size="xs"/></button>
         </div>
         </div>
         </>
         )}
         </div>
         )) : <p className="text-xs text-gray-400 text-center py-4 italic">Nenhuma nota registrada.</p>}
         </div>
       </div>
     )}

     {/* TAB: ATIVIDADES */}
     {activeTab === 'atividades' && (
       <div className="animate-in fade-in duration-200">
         <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
         {activities.length > 0 ? activities.map(act => (
         <div key={act.id} className="p-3 bg-white rounded-lg border border-gray-200 border-l-4 border-l-blue-400 group relative hover:shadow-sm transition-shadow">
          <div className="flex justify-between items-start">
          <p className="font-semibold text-sm text-gray-800 pr-2">{act.nome}</p>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-50 px-2 py-1 rounded shadow-sm border border-gray-100 absolute top-2 right-2">
            <button onClick={() => { setActivityInitialData(act); setIsActivityModalOpen(true); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="Ver / Editar"><FontAwesomeIcon icon={faPen} size="sm"/></button>
            <button onClick={() => createDeleteHandler('activities', act.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Excluir"><FontAwesomeIcon icon={faTrash} size="sm"/></button>
          </div>
          </div>
         <div className="flex justify-between mt-2 items-center pt-2 border-t border-gray-50">
         <p className="text-[10px] uppercase font-bold text-gray-400">Prazo: {act.data_fim_prevista ? format(new Date(act.data_fim_prevista), 'dd/MM/yyyy') : 'S/D'}</p>
         <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${act.status === 'Concluído' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{act.status}</span>
         </div>
         </div>
         )) : <p className="text-xs text-gray-400 text-center py-6 italic">Nenhuma atividade pendente.</p>}
         </div>
       </div>
     )}

     {/* TAB: SIMULAÇÕES */}
     {activeTab === 'simulacoes' && (
       <div className="animate-in fade-in duration-200">
         <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
         {simulations.length > 0 ? (
         simulations.map(sim => (
         <div key={sim.id} className="p-3 bg-white rounded-lg border border-gray-200 flex justify-between items-center group hover:shadow-sm transition-shadow">
         <div>
         <p className="font-bold text-sm text-gray-800">Proposta #{sim.id.toString().slice(-4)}</p>
         <p className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">{format(new Date(sim.created_at), 'dd/MM/yyyy')}</p>
         </div>
         <Link href={`/simulador-financiamento/${sim.id}`} target="_blank" rel="noopener noreferrer" className="text-[#00a884] hover:text-[#008f6f] text-[10px] uppercase font-bold border border-[#00a884] px-3 py-1.5 rounded hover:bg-[#00a884] hover:text-white transition-colors">
         <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-1"/> Abrir
         </Link>
         </div>
         ))
         ) : (
         <p className="text-xs text-gray-400 text-center py-6 italic">Nenhuma simulação encontrada.</p>
         )}
         </div>
       </div>
     )}

     {/* TAB: HISTÓRICO */}
     {activeTab === 'historico' && (
       <div className="animate-in fade-in duration-200">
         <div className="max-h-64 overflow-y-auto custom-scrollbar pr-2">
         <HistoricoTimeline history={history} />
         </div>
       </div>
     )}

     {/* TAB: ARQUIVOS */}
     {activeTab === 'arquivos' && (
       <div className="animate-in fade-in duration-200">
         <div className="mb-4">
           <div className="flex justify-between items-end mb-1.5">
             <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><FontAwesomeIcon icon={faFolderOpen} className="text-gray-500" /> Filtrar por Empreendimento</label>
             <div className="flex bg-gray-100 rounded-lg p-0.5 shadow-inner">
               <button onClick={() => setArquivosViewMode('grid')} className={`p-1 px-2.5 rounded transition-all text-xs ${arquivosViewMode === 'grid' ? 'bg-white shadow-sm text-gray-800 font-bold' : 'text-gray-400 hover:text-gray-600'}`} title="Visualização em Grade">
                 <FontAwesomeIcon icon={faTableCellsLarge} />
               </button>
               <button onClick={() => setArquivosViewMode('list')} className={`p-1 px-2.5 rounded transition-all text-xs ${arquivosViewMode === 'list' ? 'bg-white shadow-sm text-gray-800 font-bold' : 'text-gray-400 hover:text-gray-600'}`} title="Visualização em Lista">
                 <FontAwesomeIcon icon={faBars} />
               </button>
             </div>
           </div>
           <select 
             className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-gray-800 focus:border-gray-800 outline-none bg-gray-50/50"
             value={selectedEmpreendimentoId}
             onChange={(e) => setSelectedEmpreendimentoId(e.target.value)}
           >
             <option value="">Selecione um Empreendimento...</option>
             {empreendimentos.map(emp => (
               <option key={emp.id} value={emp.id}>{emp.nome}</option>
             ))}
           </select>
         </div>

         {!selectedEmpreendimentoId ? (
           <p className="text-xs text-gray-400 text-center py-6 italic bg-gray-50 rounded-lg border border-dashed border-gray-200">Selecione um empreendimento acima para ver os materiais disponíveis.</p>
         ) : isLoadingAnexos ? (
           <div className="flex justify-center py-6">
             <FontAwesomeIcon icon={faSpinner} spin className="text-gray-500 text-2xl" />
           </div>
         ) : anexosCorretor.length > 0 ? (
           <div className={arquivosViewMode === 'list' ? 'space-y-3' : 'grid grid-cols-2 gap-3'}>
             {anexosCorretor.map(anexo => {
                const ext = (anexo.caminho_arquivo || anexo.nome_arquivo || '').split('.').pop().toLowerCase();
                let icon = faFileLines;
                let colorClass = 'text-gray-500 bg-gray-100 border-gray-200';
                if (ext === 'pdf') { icon = faFilePdf; colorClass = 'text-red-500 bg-red-50 border-red-100'; }
                else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) { icon = faFileImage; colorClass = 'text-blue-500 bg-blue-50 border-blue-100'; }
                else if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) { icon = faFileVideo; colorClass = 'text-purple-500 bg-purple-50 border-purple-100'; }

                if (arquivosViewMode === 'grid') {
                   const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
                   const isVideo = ['mp4', 'mov', 'avi', 'webm'].includes(ext);
                   const isPdf = ext === 'pdf';
                   
                   return (
                     <div key={anexo.id} className="relative group rounded-xl overflow-hidden shadow-sm border bg-white flex flex-col h-40 hover:shadow-md hover:border-gray-400 transition-all">
                       <div className="flex-grow flex items-center justify-center overflow-hidden bg-gray-50 relative p-0">
                         {isImage ? (
                           <img src={anexo.thumbnail_url || anexo.public_url} alt={anexo.nome_arquivo} className="w-full h-full object-cover" />
                         ) : isVideo ? (
                           <div className="w-full h-full bg-black flex items-center justify-center">
                             <video src={anexo.public_url} className="w-full h-full object-cover opacity-80" preload="metadata" />
                             <FontAwesomeIcon icon={faFileVideo} className="absolute text-white/50 text-4xl" />
                           </div>
                         ) : isPdf ? (
                           <div className="w-full h-full relative flex items-center justify-center bg-white overflow-hidden">
                             <iframe src={`${anexo.public_url}#toolbar=0&navpanes=0&scrollbar=0`} className="absolute inset-0 w-full h-full pointer-events-none opacity-40 scale-[1.5]" title="PDF preview" />
                             <div className="z-10 bg-white/90 p-2 flex flex-col items-center justify-center rounded-lg shadow-sm border border-red-100">
                               <FontAwesomeIcon icon={faFilePdf} className="text-red-500 text-2xl mb-0.5" />
                               <span className="text-[9px] font-bold text-gray-700">PDF</span>
                             </div>
                           </div>
                         ) : (
                           <FontAwesomeIcon icon={icon} className={`text-4xl ${colorClass.split(' ')[0]}`} />
                         )}
                       </div>
                       <div className="p-2 border-t h-14 flex flex-col justify-center bg-white z-10">
                         <p className="font-semibold text-xs text-gray-800 truncate" title={anexo.nome_arquivo}>{anexo.nome_arquivo}</p>
                         <p className="text-[9px] text-gray-500 truncate mt-0.5">{anexo.descricao || anexo.tipo?.descricao || 'Material'}</p>
                       </div>
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center backdrop-blur-[2px]">
                         <button 
                           onClick={() => sendDirectAttachmentMutation.mutate(anexo)}
                           disabled={sendDirectAttachmentMutation.isPending}
                           className="text-white bg-gray-800 hover:bg-gray-900 px-4 py-2 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-50 hover:scale-105"
                           title="Enviar via WhatsApp"
                         >
                           {sendDirectAttachmentMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                           <span>Enviar</span>
                         </button>
                       </div>
                     </div>
                   );
                }

                return (
                 <div key={anexo.id} className="p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between group hover:shadow-md hover:border-gray-400 transition-all gap-3 relative overflow-hidden">
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${colorClass} shadow-sm`}>
                     <FontAwesomeIcon icon={icon} className="text-lg" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="font-semibold text-sm text-gray-800 truncate" title={anexo.nome_arquivo}>{anexo.nome_arquivo}</p>
                     <p className="text-[10px] text-gray-500 truncate mt-0.5 font-medium">{anexo.descricao || anexo.tipo?.descricao || 'Material'}</p>
                   </div>
                   <button 
                     onClick={() => sendDirectAttachmentMutation.mutate(anexo)}
                     disabled={sendDirectAttachmentMutation.isPending}
                     className="text-white bg-gray-800 hover:bg-gray-900 hover:shadow-lg hover:-translate-y-0.5 px-3 py-2 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-50 disabled:hover:translate-y-0 flex-shrink-0"
                     title="Enviar arquivo nativo para o WhatsApp do cliente"
                   >
                     {sendDirectAttachmentMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                     <span className="hidden sm:inline">Enviar</span>
                   </button>
                 </div>
                );
             })}
           </div>
         ) : (
           <p className="text-xs text-gray-400 text-center py-6 italic bg-gray-50 rounded-lg border border-dashed border-gray-200">Nenhum arquivo público disponível neste empreendimento.</p>
         )}
       </div>
      )}
  </main>

 {/* --- MODAL DE EDIÇÃO COMPLETA --- */}
 {isEditModalOpen && (
 <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex justify-center items-center p-4">
 <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
 <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white rounded-t-lg z-10">
 <h3 className="text-2xl font-bold text-gray-800">Editar Contato</h3>
 <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
 <FontAwesomeIcon icon={faTimes} size="lg" />
 </button>
 </div>
 <div className="flex-grow overflow-y-auto">
 <ContatoForm contactToEdit={displayContact} onClose={() => setIsEditModalOpen(false)} onSaveSuccess={handleSaveSuccessModal} organizacaoId={organizacaoId} criadoPorUsuarioId={user?.id} />
 </div>
 </div>
 </div>
 )}

 {isActivityModalOpen && (
   <AtividadeModal
     isOpen={isActivityModalOpen}
     onClose={() => {
       setIsActivityModalOpen(false);
       setActivityInitialData(null);
     }}
     initialData={!activityInitialData?.id ? activityInitialData : null}
      activityToEdit={activityInitialData?.id ? activityInitialData : null}
     onSuccess={() => {
       queryClient.invalidateQueries(['atividades']);
     }}
   />
 )}

 </div>
 );
}