// components/whatsapp/ContactProfile.js
"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faStickyNote, faTasks, faSpinner, faPlus, faPhone, 
    faEnvelope, faIdCard, faGlobe, faPen, faTrash, faCheckCircle, 
    faBullhorn, faUserTie, faCalculator, faExternalLinkAlt,
    faHistory, faTimes, faBriefcase, faSave, faFunnelDollar, faMoneyBillWave,
    faPiggyBank, faBullseye, faCheck, faTimesCircle
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

// Importa o Formulário Completo
import ContatoForm from '@/components/contatos/ContatoForm';
// Importa o Card do CRM para integração
import ContatoCardCRM from '@/components/crm/ContatoCardCRM';

// --- COMPONENTES AUXILIARES ---

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
        <input 
            type="text" 
            name={name} 
            value={value || ''} 
            onChange={onChange} 
            className="mt-1 text-sm text-gray-900 w-full p-1 border-b-2 border-gray-200 focus:outline-none focus:border-[#00a884] bg-transparent transition-colors" 
        />
    </div>
);

const EditableSelectBoolean = ({ label, value, name, onChange, icon }) => (
    <div className="mb-3">
        <label className="text-xs font-medium text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={icon} className="w-3 h-3"/>{label}</label>
        <select 
            name={name} 
            value={value === null || value === undefined ? "" : String(value)} 
            onChange={onChange}
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

    // 1. Dados Cadastrais COMPLETOS
    const { data: contactDetails } = await supabase
        .from('contatos')
        .select('*, telefones(*), emails(*)') 
        .eq('id', contatoId)
        .single();

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
        funilEntryData.contatos = contactDetails; 
    }

    const funilEntryId = funilEntryData?.id;

    // 3. Informações Relacionadas
    const notesPromise = supabase.from('crm_notas').select('*, usuarios(nome, sobrenome)').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('created_at', { ascending: false });
    const activitiesPromise = supabase.from('activities').select('*').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('data_inicio_prevista', { ascending: true });
    const simulationsPromise = supabase.from('simulacoes').select('id, created_at, status, valor_venda').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('created_at', { ascending: false });
    
    const historyPromise = funilEntryId 
        ? supabase.from('historico_movimentacao_funil').select('*, coluna_anterior:coluna_anterior_id(nome), coluna_nova:coluna_nova_id(nome), usuario:usuario_id(nome, sobrenome)').eq('contato_no_funil_id', funilEntryId).eq('organizacao_id', organizacaoId).order('data_movimentacao', { ascending: false })
        : Promise.resolve({ data: [] });

    const [{ data: notes }, { data: activities }, { data: simulations }, { data: history }] = await Promise.all([notesPromise, activitiesPromise, simulationsPromise, historyPromise]);

    return { 
        contactDetails: contactDetails || {}, 
        funilEntry: funilEntryData,
        funilEntryId, 
        notes: notes || [], 
        activities: activities || [], 
        simulations: simulations || [],
        history: history || []
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
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); 
    const [isEditing, setIsEditing] = useState(false); 
    const [editData, setEditData] = useState({});
    
    const [newNoteContent, setNewNoteContent] = useState('');
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editingNoteContent, setEditingNoteContent] = useState('');

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
    
    const { notes = [], activities = [], simulations = [], history = [], funilEntry, contactDetails, funilEntryId } = profileData || {};
    
    const displayContact = { ...contact, ...contactDetails };

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

            const { error } = await supabase.from('contatos').update({ 
                nome, razao_social, cpf, cnpj, origem, cargo, objetivo,
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
            await supabase.from('crm_notas').insert({ 
                contato_id: contact.contato_id, 
                contato_no_funil_id: funilEntryId, 
                conteudo: noteContent, 
                usuario_id: user.id, 
                organizacao_id: organizacaoId 
            }).throwOnError();
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

    if (!contact) return <div className="p-4 text-center text-sm text-gray-500">Selecione uma conversa.</div>;
    if (isLoading) return <div className="p-8 text-center text-gray-500"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-2 text-[#00a884]"/><p>Carregando perfil...</p></div>;

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200">
            {/* Cabeçalho Fixo */}
            <div className="flex flex-col items-center p-6 border-b bg-gray-50/50">
                <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-3xl font-bold text-white overflow-hidden mb-3 shadow-sm border-2 border-white">
                    {displayContact.foto_url ? (
                        <img src={displayContact.foto_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        (displayContact.nome || '?').charAt(0).toUpperCase()
                    )}
                </div>
                <h3 className="text-lg font-bold text-gray-900 text-center leading-tight">{displayContact.nome}</h3>
                <p className="text-sm text-gray-500 mt-1">{displayContact.telefone || displayContact.phone_number}</p>
                
                {/* --- CAMPO RENDA FAMILIAR NO CABEÇALHO --- */}
                {displayContact.renda_familiar && (
                     <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-200 shadow-sm">
                        <FontAwesomeIcon icon={faMoneyBillWave} className="mr-1.5" />
                        {formatCurrency(displayContact.renda_familiar)}
                    </div>
                )}

                {displayContact.cargo && <p className="text-xs text-gray-400 font-medium mt-2 uppercase tracking-wide">{displayContact.cargo}</p>}
            </div>

            <main className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                
                {funilEntry && (
                    <section className="animate-in fade-in slide-in-from-top-4 duration-300">
                        <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm uppercase tracking-wide">
                            <FontAwesomeIcon icon={faFunnelDollar} /> CRM / Funil
                        </h4>
                        <ContatoCardCRM
                            funilEntry={funilEntry}
                            allColumns={allColumns}
                            availableProducts={availableProducts}
                            onDragStart={() => {}}
                            onCardClick={() => {}}
                            onMoveToColumn={(cardId, colId) => moveCardMutation.mutate({ cardId, newColumnId: colId })}
                            onAssociateProduct={(cardId, prodId) => associateProductMutation.mutate({ cardId, productId: prodId })}
                            onDissociateProduct={(itemId) => dissociateProductMutation.mutate(itemId)}
                            onAssociateCorretor={(cardId, corrId) => associateCorretorMutation.mutate({ cardId, corretorId: corrId })}
                            onDeleteCard={(cardId) => deleteCardMutation.mutate(cardId)}
                            onOpenNotesModal={() => {
                                if (notesSectionRef.current) {
                                    notesSectionRef.current.scrollIntoView({ behavior: 'smooth' });
                                    toast.info("Role para baixo para ver as notas.");
                                }
                            }}
                            onAddActivity={() => toast.info("Use o menu de atividades abaixo.")}
                        />
                    </section>
                )}

                {/* --- NOVA SEÇÃO: QUALIFICAÇÃO FINANCEIRA --- */}
                <section>
                    <div className="flex justify-between items-center mb-3">
                         <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
                             <FontAwesomeIcon icon={faCalculator} /> Qualificação
                         </h4>
                         
                         {/* BOTÕES DE AÇÃO GLOBAIS (Edit/Save) */}
                         {isEditing ? (
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                                <button onClick={() => saveContactMutation.mutate(editData)} disabled={saveContactMutation.isPending} className="text-xs bg-[#00a884] text-white px-2 py-1 rounded hover:bg-[#008f6f]">
                                    {saveContactMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin/> : <FontAwesomeIcon icon={faSave} />} Salvar
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button onClick={() => setIsEditing(true)} className="text-xs text-blue-600 hover:text-blue-800" title="Edição Rápida">
                                    <FontAwesomeIcon icon={faPen}/> Rápido
                                </button>
                                <button onClick={() => setIsEditModalOpen(true)} className="text-xs text-gray-500 hover:text-gray-800" title="Edição Completa">
                                    <FontAwesomeIcon icon={faExternalLinkAlt}/> Completo
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={`grid grid-cols-2 gap-3 ${isEditing ? '' : 'bg-blue-50/50 p-3 rounded-lg border border-blue-100'}`}>
                         {isEditing ? (
                             <>
                                <div className="col-span-2">
                                    <EditableField label="Objetivo" value={editData.objetivo} name="objetivo" onChange={(e) => setEditData({ ...editData, objetivo: e.target.value })} icon={faBullseye} />
                                </div>
                                <div className="col-span-2">
                                    <EditableField label="Renda Familiar" value={editData.renda_familiar} name="renda_familiar" onChange={(e) => setEditData({ ...editData, renda_familiar: e.target.value })} icon={faMoneyBillWave} />
                                </div>
                                <EditableSelectBoolean label="Possui FGTS?" value={editData.fgts} name="fgts" onChange={(e) => setEditData({ ...editData, fgts: e.target.value })} icon={faPiggyBank} />
                                <EditableSelectBoolean label="+3 Anos CLT?" value={editData.mais_de_3_anos_clt} name="mais_de_3_anos_clt" onChange={(e) => setEditData({ ...editData, mais_de_3_anos_clt: e.target.value })} icon={faBriefcase} />
                             </>
                          ) : (
                             <>
                                <div className="col-span-2">
                                    <InfoField label="Objetivo" value={displayContact.objetivo} icon={faBullseye} highlight={true} />
                                </div>
                                <div className="col-span-2">
                                     <InfoField label="Renda Familiar" value={formatCurrency(displayContact.renda_familiar)} icon={faMoneyBillWave} highlight={true} />
                                </div>
                                <BooleanBadge label="Possui FGTS?" value={displayContact.fgts} icon={faPiggyBank} />
                                <BooleanBadge label="+3 Anos CLT?" value={displayContact.mais_de_3_anos_clt} icon={faBriefcase} trueColor="bg-blue-100 text-blue-800" />
                             </>
                          )}
                    </div>
                </section>

                {/* Seção de Dados Cadastrais (Reduzida para evitar duplicação visual, mas mantendo campos chave) */}
                <section>
                    <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Dados Pessoais</h4>
                    <div className={`grid grid-cols-1 gap-y-1 ${isEditing ? '' : 'bg-gray-50 p-3 rounded-lg border'}`}>
                        {isEditing ? (
                            <>
                                <EditableField label="Nome/Razão Social" value={editData.nome || editData.razao_social} name={displayContact.personalidade_juridica === 'Pessoa Física' ? 'nome' : 'razao_social'} onChange={(e) => setEditData({ ...editData, [e.target.name]: e.target.value })} icon={faIdCard} />
                                <EditableField label="Profissão" value={editData.cargo} name="cargo" onChange={(e) => setEditData({ ...editData, cargo: e.target.value })} icon={faBriefcase} />
                                <EditableField label="Telefone" value={editData.telefone} name="telefone" onChange={(e) => setEditData({ ...editData, telefone: e.target.value })} icon={faPhone} />
                                <EditableField label="Email" value={editData.email} name="email" onChange={(e) => setEditData({ ...editData, email: e.target.value })} icon={faEnvelope} />
                                <EditableField label="CPF/CNPJ" value={editData.cpf || editData.cnpj} name={displayContact.personalidade_juridica === 'Pessoa Física' ? 'cpf' : 'cnpj'} onChange={(e) => setEditData({ ...editData, [e.target.name]: e.target.value })} icon={faIdCard} />
                                <EditableField label="Origem" value={editData.origem} name="origem" onChange={(e) => setEditData({ ...editData, origem: e.target.value })} icon={faGlobe} />
                            </>
                        ) : (
                            <>
                                <InfoField label="Profissão" value={displayContact.cargo} icon={faBriefcase} />
                                <InfoField label="Email" value={displayContact.email} icon={faEnvelope} />
                                <InfoField label="CPF/CNPJ" value={displayContact.cpf || displayContact.cnpj} icon={faIdCard} />
                                <InfoField label="Origem" value={displayContact.origem} icon={faGlobe} />
                            </>
                        )}
                    </div>
                </section>

                <MetaFormData data={displayContact.meta_form_data} />

                {/* Seção de Notas */}
                <section ref={notesSectionRef}>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm uppercase tracking-wide"><FontAwesomeIcon icon={faStickyNote} /> Notas</h4>
                    <div className="space-y-3">
                        {funilEntryId ? (
                            <div className="relative">
                                <textarea 
                                    value={newNoteContent} 
                                    onChange={(e) => setNewNoteContent(e.target.value)} 
                                    placeholder="Escreva uma nota..." 
                                    className="w-full p-2 border rounded-md text-sm bg-yellow-50 focus:bg-white transition-colors focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 outline-none resize-none" 
                                    rows={2}
                                ></textarea>
                                <button 
                                    onClick={() => addNoteMutation.mutate(newNoteContent)} 
                                    disabled={addNoteMutation.isPending || !newNoteContent.trim()} 
                                    className="absolute bottom-2 right-2 text-gray-400 hover:text-[#00a884] disabled:opacity-50 transition-colors"
                                >
                                    {addNoteMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} />}
                                </button>
                            </div>
                        ) : (
                            <div className="text-xs text-center text-gray-400 bg-gray-50 p-2 rounded">Contato fora do funil. Notas indisponíveis.</div>
                        )}

                        <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                            {notes.length > 0 ? notes.map(note => (
                                <div key={note.id} className="bg-yellow-50 p-3 rounded border border-yellow-100 text-sm group relative hover:shadow-sm transition-shadow">
                                    {editingNoteId === note.id ? (
                                        <div>
                                            <textarea value={editingNoteContent} onChange={(e) => setEditingNoteContent(e.target.value)} className="w-full p-1 border rounded text-xs bg-white" rows={3}/>
                                            <div className="flex justify-end gap-2 mt-1">
                                                <button onClick={() => setEditingNoteId(null)} className="text-xs text-gray-500">Cancelar</button>
                                                <button onClick={() => handleSaveNoteEdit(note.id)} className="text-xs font-semibold text-blue-600">Salvar</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-gray-800 whitespace-pre-wrap text-xs leading-relaxed">{note.conteudo}</p>
                                            <div className="flex justify-between items-end mt-2">
                                                <p className="text-[10px] text-gray-400">{note.usuarios?.nome} • {format(new Date(note.created_at), 'dd/MM HH:mm')}</p>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.conteudo); }} className="text-gray-400 hover:text-blue-600"><FontAwesomeIcon icon={faPen} size="xs"/></button>
                                                    <button onClick={() => createDeleteHandler('crm_notas', note.id)} className="text-gray-400 hover:text-red-600"><FontAwesomeIcon icon={faTrash} size="xs"/></button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )) : <p className="text-xs text-gray-400 text-center py-2 italic">Nenhuma nota registrada.</p>}
                        </div>
                    </div>
                </section>

                <section>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm uppercase tracking-wide"><FontAwesomeIcon icon={faCalculator} /> Simulações</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-gray-50 custom-scrollbar">
                        {simulations.length > 0 ? (
                            simulations.map(sim => (
                                <div key={sim.id} className="p-3 bg-white rounded border flex justify-between items-center group hover:shadow-sm transition-shadow">
                                    <div>
                                        <p className="font-semibold text-sm text-gray-800">Proposta #{sim.id.toString().slice(-4)}</p>
                                        <p className="text-xs text-gray-500">{format(new Date(sim.created_at), 'dd/MM/yyyy')}</p>
                                    </div>
                                    <Link href={`/simulador-financiamento/${sim.id}`} target="_blank" rel="noopener noreferrer" className="text-[#00a884] hover:text-[#008f6f] text-xs font-semibold border border-[#00a884] px-2 py-1 rounded hover:bg-[#00a884] hover:text-white transition-colors">
                                        <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-1"/> Abrir
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-400 text-center py-4 italic">Nenhuma simulação encontrada.</p>
                        )}
                    </div>
                </section>

                <section>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm uppercase tracking-wide"><FontAwesomeIcon icon={faTasks} /> Atividades</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-gray-50 custom-scrollbar">
                        {activities.length > 0 ? activities.map(act => (
                            <div key={act.id} className="p-3 bg-white rounded border border-l-4 border-l-blue-400 group relative">
                                <div className="flex justify-between items-start">
                                    <p className="font-semibold text-sm text-gray-800">{act.nome}</p>
                                    <button onClick={() => createDeleteHandler('activities', act.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><FontAwesomeIcon icon={faTrash} size="xs"/></button>
                                </div>
                                <div className="flex justify-between mt-1 items-center">
                                    <p className="text-xs text-gray-500">Prazo: {act.data_fim_prevista ? format(new Date(act.data_fim_prevista), 'dd/MM') : 'S/D'}</p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${act.status === 'Concluído' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{act.status}</span>
                                </div>
                            </div>
                        )) : <p className="text-xs text-gray-400 text-center py-4 italic">Nenhuma atividade pendente.</p>}
                    </div>
                </section>
                
                <section>
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm uppercase tracking-wide"><FontAwesomeIcon icon={faHistory} /> Histórico</h4>
                    <div className="max-h-56 overflow-y-auto border rounded-lg p-4 bg-gray-50 custom-scrollbar">
                         <HistoricoTimeline history={history} />
                    </div>
                </section>
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
                            <ContatoForm 
                                contactToEdit={displayContact} 
                                onClose={() => setIsEditModalOpen(false)} 
                                onSaveSuccess={handleSaveSuccessModal} 
                                organizacaoId={organizacaoId} 
                                criadoPorUsuarioId={user?.id} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}