//components\crm\CrmDetalhesSidebar.js
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faStickyNote, faTasks, faSpinner, faPlus, faPhone, faEnvelope, faIdCard, faGlobe, faPen, faTrash, faCheckCircle, faSave, faBullhorn, faUserTie, faCalculator, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // Imports atualizados
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatDateString = (dateStr) => {
    if (!dateStr || !dateStr.includes('-')) return 'Não definido';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

const EditableField = ({ label, value, name, onChange, icon }) => (
    <div>
        <label className="text-xs font-medium text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={icon} />{label}</label>
        <input type="text" name={name} value={value || ''} onChange={onChange} className="mt-1 text-sm text-gray-900 w-full p-1 border-b-2 border-gray-200 focus:outline-none focus:border-blue-500" />
    </div>
);

const InfoField = ({ label, value, icon }) => (
    <div>
        <dt className="text-xs font-medium text-gray-500 flex items-center gap-2"><FontAwesomeIcon icon={icon} />{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value || 'N/A'}</dd>
    </div>
);

const MetaFormData = ({ data }) => {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return null;
    const filteredData = { ...data };
    delete filteredData.full_name;
    delete filteredData.email;
    delete filteredData.phone_number;
    return (
        <section>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faBullhorn} />Dados do Formulário Meta</h4>
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

// =================================================================================
// ATUALIZAÇÃO DE PADRÃO E SEGURANÇA
// O PORQUÊ: Centralizamos a busca de dados em uma função para useQuery e adicionamos
// o filtro de segurança `organizacaoId` em todas as consultas.
// =================================================================================
const fetchSidebarData = async (supabase, contatoId, organizacaoId) => {
    if (!contatoId || !organizacaoId) return null;

    const notesPromise = supabase.from('crm_notas').select('*, usuarios(nome, sobrenome)').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('created_at', { ascending: false });
    const activitiesPromise = supabase.from('activities').select('*').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('data_inicio_prevista', { ascending: true });
    const simulationsPromise = supabase.from('simulacoes').select('id, created_at, status, valor_venda').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId).order('created_at', { ascending: false });

    const [{ data: notesData, error: notesError }, { data: activitiesData, error: activitiesError }, { data: simulationsData, error: simulationsError }] = await Promise.all([notesPromise, activitiesPromise, simulationsPromise]);

    if (notesError || activitiesError || simulationsError) {
        console.error({ notesError, activitiesError, simulationsError });
        throw new Error("Erro ao carregar detalhes do contato.");
    }

    return { notes: notesData || [], activities: activitiesData || [], simulations: simulationsData || [] };
};

export default function CrmDetalhesSidebar({ open, onClose, funilEntry, onAddActivity, onEditActivity, onContactUpdate, refreshKey }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();

    const contato = funilEntry?.contatos;
    const corretor = funilEntry?.corretores;
    const contatoNoFunilId = funilEntry?.id;

    const [newNoteContent, setNewNoteContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editingNoteContent, setEditingNoteContent] = useState('');

    const { data: sidebarData, isLoading: loading } = useQuery({
        queryKey: ['crmSidebarData', contato?.id, organizacaoId, refreshKey],
        queryFn: () => fetchSidebarData(supabase, contato?.id, organizacaoId),
        enabled: !!open && !!contato?.id && !!organizacaoId,
    });
    
    const { notes = [], activities = [], simulations = [] } = sidebarData || {};

    const initializeEditData = useCallback((c) => {
        if (!c) return;
        setEditData({
            nome: c.nome || '',
            razao_social: c.razao_social || '',
            telefone: c.telefones?.[0]?.telefone || '',
            email: c.emails?.[0]?.email || '',
            cpf: c.cpf || '',
            cnpj: c.cnpj || '',
            origem: c.origem || ''
        });
    }, []);

    useEffect(() => {
        if (contato) {
            initializeEditData(contato);
            setIsEditing(false);
        }
    }, [contato?.id, initializeEditData]);
    
    // =================================================================================
    // ATUALIZAÇÃO DE PADRÃO E SEGURANÇA (useMutation)
    // O PORQUÊ: Cada ação de escrita agora tem sua própria `mutation`. Isso padroniza
    // o código, melhora o feedback com `toast`, e garante que o `organizacaoId`
    // seja aplicado em todas as operações de segurança.
    // =================================================================================
    const saveContactMutation = useMutation({
        mutationFn: async (updatedData) => {
            const { nome, razao_social, cpf, cnpj, origem, telefone, email } = updatedData;
            // Atualiza o contato principal
            const { error: contactError } = await supabase.from('contatos').update({ nome, razao_social, cpf, cnpj, origem }).eq('id', contato.id);
            if (contactError) throw contactError;

            // Lógica para upsert de telefone e email, garantindo a `organizacao_id`
            if (telefone) await supabase.from('telefones').upsert({ id: contato.telefones?.[0]?.id, contato_id: contato.id, telefone, tipo: 'Principal', organizacao_id: organizacaoId }, { onConflict: 'id' });
            if (email) await supabase.from('emails').upsert({ id: contato.emails?.[0]?.id, contato_id: contato.id, email, tipo: 'Principal', organizacao_id: organizacaoId }, { onConflict: 'id' });
        },
        onSuccess: () => {
            setIsEditing(false);
            onContactUpdate();
            toast.success("Contato atualizado com sucesso!");
        },
        onError: (error) => toast.error(`Erro ao salvar: ${error.message}`)
    });

    const addNoteMutation = useMutation({
        mutationFn: (noteContent) => supabase.from('crm_notas').insert({ contato_id: contato.id, contato_no_funil_id: contatoNoFunilId, conteudo: noteContent, usuario_id: user.id, organizacao_id: organizacaoId }).throwOnError(),
        onSuccess: () => {
            setNewNoteContent('');
            queryClient.invalidateQueries({ queryKey: ['crmSidebarData', contato?.id, organizacaoId] });
        }
    });
    
    const crudMutation = useMutation({
        mutationFn: async ({ action, table, data, id }) => {
            let query;
            if (action === 'update') query = supabase.from(table).update(data).eq('id', id).eq('organizacao_id', organizacaoId);
            else if (action === 'delete') query = supabase.from(table).delete().eq('id', id).eq('organizacao_id', organizacaoId);
            const { error } = await query;
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crmSidebarData', contato?.id, organizacaoId] });
        }
    });

    const handleSave = () => saveContactMutation.mutate(editData);
    const handleAddNote = () => !addNoteMutation.isPending && newNoteContent.trim() && addNoteMutation.mutate(newNoteContent);
    const handleCompleteActivity = (activityId) => crudMutation.mutate({ action: 'update', table: 'activities', data: { status: 'Concluído' }, id: activityId });
    const handleSaveNoteEdit = (noteId) => crudMutation.mutate({ action: 'update', table: 'crm_notas', data: { conteudo: editingNoteContent }, id: noteId, onSuccess: () => setEditingNoteId(null) });

    const createDeleteHandler = (itemType, itemId) => {
        toast(`Confirmar Exclusão`, {
            description: `Tem certeza que deseja excluir este item?`,
            action: { label: "Excluir", onClick: () => crudMutation.mutate({ action: 'delete', table: itemType, id: itemId }) },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };

    if (!open || !contato) return null;

    return (
        <div 
            className="fixed top-0 right-0 h-full w-full md:w-[450px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out"
            style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
        >
            <div className="flex flex-col h-full">
                <header className="p-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-800">{contato.nome || contato.razao_social}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                </header>
                
                <main className="flex-1 overflow-y-auto p-4 space-y-6">
                    {loading ? ( 
                        <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div> 
                    ) : (
                        <>
                            <section>
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-semibold text-gray-700">Detalhes do Contato</h4>
                                    {isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => { setIsEditing(false); initializeEditData(contato); }} disabled={saveContactMutation.isPending} className="text-sm font-semibold text-gray-600 hover:text-gray-800">Cancelar</button>
                                            <button onClick={handleSave} disabled={saveContactMutation.isPending} className="text-sm font-semibold bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                                                {saveContactMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin/> : <FontAwesomeIcon icon={faSave} />} Salvar
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setIsEditing(true)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"><FontAwesomeIcon icon={faPen}/> Editar</button>
                                    )}
                                </div>
                                <dl className="grid grid-cols-1 gap-y-4">
                                    {isEditing ? (
                                        <>
                                            <EditableField label="Nome/Razão Social" value={editData.nome || editData.razao_social} name={contato.personalidade_juridica === 'Pessoa Física' ? 'nome' : 'razao_social'} onChange={(e) => setEditData(prev => ({ ...prev, [e.target.name]: e.target.value }))} icon={faIdCard} />
                                            <EditableField label="Telefone" value={editData.telefone} name="telefone" onChange={(e) => setEditData(prev => ({ ...prev, telefone: e.target.value }))} icon={faPhone} />
                                            <EditableField label="Email" value={editData.email} name="email" onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))} icon={faEnvelope} />
                                            <EditableField label="CPF/CNPJ" value={editData.cpf || editData.cnpj} name={contato.personalidade_juridica === 'Pessoa Física' ? 'cpf' : 'cnpj'} onChange={(e) => setEditData(prev => ({ ...prev, [e.target.name]: e.target.value }))} icon={faIdCard} />
                                            <EditableField label="Origem" value={editData.origem} name="origem" onChange={(e) => setEditData(prev => ({ ...prev, origem: e.target.value }))} icon={faGlobe} />
                                        </>
                                    ) : (
                                        <>
                                            <InfoField label="Telefone" value={contato.telefones?.[0]?.telefone} icon={faPhone} />
                                            <InfoField label="Email" value={contato.emails?.[0]?.email} icon={faEnvelope} />
                                            <InfoField label="CPF/CNPJ" value={contato.cpf || contato.cnpj} icon={faIdCard} />
                                            <InfoField label="Origem" value={contato.origem} icon={faGlobe} />
                                            <InfoField label="Corretor" value={corretor?.nome || 'Não associado'} icon={faUserTie} />
                                        </>
                                    )}
                                </dl>
                            </section>
                            
                            <MetaFormData data={contato.meta_form_data} />
                            
                            <section>
                                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faCalculator} /> Simulações</h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-50">
                                    {simulations.length > 0 ? (
                                        simulations.map(sim => (
                                            <div key={sim.id} className="p-2 bg-white rounded-md text-sm border flex justify-between items-center group">
                                                <div>
                                                    <p className="font-semibold">Proposta #{sim.id}</p>
                                                    <p className="text-xs text-gray-500">
                                                        Em: {format(new Date(sim.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })} - Status: {sim.status}
                                                    </p>
                                                </div>
                                                <Link href={`/simulador-financiamento/${sim.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs font-semibold">
                                                    <FontAwesomeIcon icon={faExternalLinkAlt} /> Visualizar
                                                </Link>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-gray-500 text-center py-4">Nenhuma simulação encontrada.</p>
                                    )}
                                </div>
                            </section>

                            <section>
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-gray-700 flex items-center gap-2"><FontAwesomeIcon icon={faTasks} />Atividades</h4>
                                    <button onClick={() => onAddActivity(contato)} className="text-blue-600 hover:text-blue-800 text-sm font-semibold"><FontAwesomeIcon icon={faPlus} /> Adicionar</button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-50">
                                    {activities.length > 0 ? activities.map(act => (
                                        <div key={act.id} className="p-2 bg-white rounded-md text-sm border flex justify-between items-center group">
                                            <div className="flex-1">
                                                <p className="font-semibold">{act.nome}</p>
                                                <p className="text-xs text-gray-500">Prazo: {formatDateString(act.data_fim_prevista)}</p>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {act.status !== 'Concluído' && <button onClick={() => handleCompleteActivity(act.id)} className="text-green-500 hover:text-green-700" title="Marcar como concluída"><FontAwesomeIcon icon={faCheckCircle} /></button>}
                                                <button onClick={() => onEditActivity(act)} className="text-gray-500 hover:text-blue-700" title="Editar"><FontAwesomeIcon icon={faPen} /></button>
                                                <button onClick={() => createDeleteHandler('activities', act.id)} className="text-gray-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                                            </div>
                                        </div>
                                    )) : <p className="text-xs text-gray-500 text-center py-4">Nenhuma atividade agendada.</p>}
                                </div>
                            </section>

                            <section>
                                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faStickyNote} />Notas</h4>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <textarea value={newNoteContent} onChange={(e) => setNewNoteContent(e.target.value)} placeholder="Adicionar uma nota..." className="w-full p-2 border rounded-md text-sm" rows={3}></textarea>
                                        <button onClick={handleAddNote} disabled={addNoteMutation.isPending || !newNoteContent.trim()} className="absolute bottom-2 right-2 bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-blue-700 disabled:bg-gray-400">
                                            {addNoteMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar'}
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-56 overflow-y-auto border rounded-md p-2 bg-gray-50">
                                        {notes.length > 0 ? notes.map(note => (
                                            <div key={note.id} className="bg-white p-2 rounded border text-sm group">
                                                {editingNoteId === note.id ? (
                                                    <div>
                                                        <textarea value={editingNoteContent} onChange={(e) => setEditingNoteContent(e.target.value)} className="w-full p-1 border rounded" rows={3}/>
                                                        <div className="flex justify-end gap-2 mt-1">
                                                            <button onClick={() => setEditingNoteId(null)} className="text-xs">Cancelar</button>
                                                            <button onClick={() => handleSaveNoteEdit(note.id)} className="text-xs font-semibold text-blue-600">{crudMutation.isPending ? 'Salvando...' : 'Salvar'}</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-gray-800 whitespace-pre-wrap">{note.conteudo}</p>
                                                        <div className="flex justify-between items-center mt-1">
                                                            <p className="text-xs text-gray-500">{note.usuarios?.nome} - {format(new Date(note.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</p>
                                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.conteudo); }} className="text-gray-500 hover:text-blue-700" title="Editar"><FontAwesomeIcon icon={faPen} /></button>
                                                                <button onClick={() => createDeleteHandler('crm_notas', note.id)} className="text-gray-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )) : <p className="text-xs text-gray-500 text-center py-4">Nenhuma nota adicionada.</p>}
                                    </div>
                                </div>
                            </section>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}