// components/ContatoDetalhesSidebar.js

"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, faStickyNote, faTasks, faSpinner, faPlus, faPhone, faEnvelope, faIdCard, 
    faGlobe, faPen, faTrash, faCheckCircle, faSave, faUserTie, faBuilding, faBriefcase, 
    faBirthdayCake, faRing
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IMaskInput } from 'react-imask';
import { formatPhoneNumber } from '../utils/formatters';

// FUNÇÕES AUXILIARES
const formatDateString = (dateStr) => {
    if (!dateStr || !dateStr.includes('-')) return 'Não definido';
    const [year, month, day] = dateStr.split('T')[0].split('-');
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

// COMPONENTE PRINCIPAL DO SIDEBAR
export default function ContatoDetalhesSidebar({ open, onClose, contato, onActionComplete, onAddActivity, onEditActivity }) {
    const supabase = createClient();
    const { user, userData } = useAuth(); // <--- 1. PEGAMOS O 'userData' PARA TER O 'organizacao_id'
    
    const [notes, setNotes] = useState([]);
    const [activities, setActivities] = useState([]);
    const [newNoteContent, setNewNoteContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editingNoteContent, setEditingNoteContent] = useState('');

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

    const fetchData = useCallback(async () => {
        if (!contato?.id) return;
        setLoading(true);

        try {
            const notesPromise = supabase.from('crm_notas').select('*, usuarios(nome, sobrenome)').eq('contato_id', contato.id).order('created_at', { ascending: false });
            const activitiesPromise = supabase.from('activities').select('*').eq('contato_id', contato.id).order('data_inicio_prevista', { ascending: true });
            
            const [{ data: notesData, error: notesError }, { data: activitiesData, error: activitiesError }] = await Promise.all([notesPromise, activitiesPromise]);

            if (notesError) throw notesError;
            if (activitiesError) throw activitiesError;

            setNotes(notesData || []);
            setActivities(activitiesData || []);
        } catch (error) {
            toast.error("Erro ao carregar detalhes do contato.");
        } finally {
            setLoading(false);
        }
    }, [contato, supabase]);

    useEffect(() => {
        if (open && contato) {
            fetchData();
        }
    }, [open, contato, fetchData]);

    useEffect(() => {
        if (contato) {
            initializeEditData(contato);
            setIsEditing(false);
        }
    }, [contato?.id, initializeEditData]);

    const handleEditChange = (e) => setEditData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSave = async () => {
        setSaving(true);
        const { nome, razao_social, cpf, cnpj, origem, telefone, email } = editData;
        const updatePromises = [];
        updatePromises.push(supabase.from('contatos').update({ nome, razao_social, cpf, cnpj, origem }).eq('id', contato.id));
        if (telefone && contato.telefones?.[0]?.id) { updatePromises.push(supabase.from('telefones').update({ telefone }).eq('id', contato.telefones[0].id)); }
        if (email && contato.emails?.[0]?.id) { updatePromises.push(supabase.from('emails').update({ email }).eq('id', contato.emails[0].id)); }

        toast.promise(Promise.all(updatePromises), {
            loading: 'Salvando...',
            success: () => {
                setSaving(false);
                setIsEditing(false);
                if (onActionComplete) onActionComplete();
                return "Contato atualizado com sucesso!";
            },
            error: (err) => {
                setSaving(false);
                return `Erro ao salvar: ${err.message}`;
            }
        });
    };
    
    // ---> 2. AQUI ESTÁ A MUDANÇA MÁGICA <---
    const handleAddNote = async () => { 
        if (!newNoteContent.trim()) return; 
        
        // Verificação de segurança
        if (!userData?.organizacao_id) {
            toast.error('Erro de segurança: Organização do usuário não encontrada.');
            return;
        }

        setSaving(true); 
        const { error } = await supabase.from('crm_notas').insert({ 
            contato_id: contato.id, 
            conteudo: newNoteContent, 
            usuario_id: user.id,
            organizacao_id: userData.organizacao_id // <-- Adiciona o "carimbo" da organização!
        }); 
        
        if (error) { 
            toast.error(error.message); 
        } else { 
            setNewNoteContent(''); 
            fetchData(); 
        } 
        setSaving(false); 
    };

    const handleCompleteActivity = async (activityId) => { const { error } = await supabase.from('activities').update({ status: 'Concluído' }).eq('id', activityId); if (error) toast.error(error.message); else fetchData(); };
    const handleDeleteActivity = async (activityId) => { if (window.confirm('Tem certeza?')) { const { error } = await supabase.from('activities').delete().eq('id', activityId); if (error) toast.error(error.message); else fetchData(); }};
    const handleStartEditingNote = (note) => { setEditingNoteId(note.id); setEditingNoteContent(note.conteudo); };
    const handleSaveNoteEdit = async (noteId) => { setSaving(true); const { error } = await supabase.from('crm_notas').update({ conteudo: editingNoteContent }).eq('id', noteId); if (error) toast.error(error.message); else { setEditingNoteId(null); setEditingNoteContent(''); fetchData(); } setSaving(false); };
    const handleDeleteNote = async (noteId) => { if (window.confirm('Tem certeza?')) { const { error } = await supabase.from('crm_notas').delete().eq('id', noteId); if (error) toast.error(error.message); else fetchData(); }};

    if (!open || !contato) return null;

    const isPessoaFisica = contato.personalidade_juridica === 'Pessoa Física';

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
                                            <button onClick={() => { setIsEditing(false); initializeEditData(contato); }} disabled={saving} className="text-sm font-semibold text-gray-600 hover:text-gray-800">Cancelar</button>
                                            <button onClick={handleSave} disabled={saving} className="text-sm font-semibold bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                                                {saving ? <FontAwesomeIcon icon={faSpinner} spin/> : <FontAwesomeIcon icon={faSave} />} Salvar
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setIsEditing(true)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"><FontAwesomeIcon icon={faPen}/> Editar</button>
                                    )}
                                </div>
                                <dl className="grid grid-cols-1 gap-y-4">
                                    {isEditing ? (
                                        <>
                                            <EditableField label="Nome/Razão Social" value={editData.nome || editData.razao_social} name={isPessoaFisica ? 'nome' : 'razao_social'} onChange={handleEditChange} icon={faIdCard} />
                                            <EditableField label="Telefone" value={editData.telefone} name="telefone" onChange={handleEditChange} icon={faPhone} />
                                            <EditableField label="Email" value={editData.email} name="email" onChange={handleEditChange} icon={faEnvelope} />
                                            <EditableField label="CPF/CNPJ" value={editData.cpf || editData.cnpj} name={isPessoaFisica ? 'cpf' : 'cnpj'} onChange={handleEditChange} icon={faIdCard} />
                                            <EditableField label="Origem" value={editData.origem} name="origem" onChange={handleEditChange} icon={faGlobe} />
                                        </>
                                    ) : (
                                        <>
                                            <InfoField label="Telefone" value={formatPhoneNumber(contato.telefones?.[0]?.telefone)} icon={faPhone} />
                                            <InfoField label="Email" value={contato.emails?.[0]?.email} icon={faEnvelope} />
                                            <InfoField label="CPF/CNPJ" value={contato.cpf || contato.cnpj} icon={faIdCard} />
                                            <InfoField label="Origem" value={contato.origem} icon={faGlobe} />
                                        </>
                                    )}
                                </dl>
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
                                                <button onClick={() => handleDeleteActivity(act.id)} className="text-gray-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
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
                                        <button onClick={handleAddNote} disabled={saving || !newNoteContent.trim()} className="absolute bottom-2 right-2 bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-blue-700 disabled:bg-gray-400">
                                            {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar'}
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
                                                            <button onClick={() => handleSaveNoteEdit(note.id)} className="text-xs font-semibold text-blue-600">{saving ? 'Salvando...' : 'Salvar'}</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-gray-800 whitespace-pre-wrap">{note.conteudo}</p>
                                                        <div className="flex justify-between items-center mt-1">
                                                            <p className="text-xs text-gray-500">{note.usuarios?.nome} - {format(new Date(note.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</p>
                                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => handleStartEditingNote(note)} className="text-gray-500 hover:text-blue-700" title="Editar"><FontAwesomeIcon icon={faPen} /></button>
                                                                <button onClick={() => handleDeleteNote(note.id)} className="text-gray-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
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

// --------------------------------------------------------------------------------
// COMENTÁRIO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente é uma barra lateral (sidebar) que desliza para a direita para
// mostrar informações detalhadas de um contato específico. Ele exibe os dados
// principais do contato e permite uma edição rápida desses dados. Além disso,
// ele possui seções para visualizar, adicionar e gerenciar atividades e notas
// relacionadas diretamente a esse contato, servindo como um mini-dashboard.
// --------------------------------------------------------------------------------