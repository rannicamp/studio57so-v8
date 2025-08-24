// components/crm/CrmDetalhesSidebar.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faStickyNote, faTasks, faSpinner, faPlus, faPhone, faEnvelope, faIdCard, faGlobe, faPen, faTrash, faCheckCircle, faSave, faBullhorn } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Componente para um campo editável
const EditableField = ({ label, value, name, onChange, icon }) => (
    <div>
        <label className="text-xs font-medium text-gray-500 flex items-center gap-2">
            <FontAwesomeIcon icon={icon} />
            {label}
        </label>
        <input
            type="text"
            name={name}
            value={value || ''}
            onChange={onChange}
            className="mt-1 text-sm text-gray-900 w-full p-1 border-b-2 border-gray-200 focus:outline-none focus:border-blue-500"
        />
    </div>
);

// Componente para exibir um campo de informação
const InfoField = ({ label, value, icon }) => (
    <div>
        <dt className="text-xs font-medium text-gray-500 flex items-center gap-2">
            <FontAwesomeIcon icon={icon} />
            {label}
        </dt>
        <dd className="mt-1 text-sm text-gray-900">{value || 'N/A'}</dd>
    </div>
);

// ***** NOVO COMPONENTE *****
// Componente para exibir os dados do formulário da Meta
const MetaFormData = ({ data }) => {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        return null;
    }

    // Remove campos que já são exibidos em outros locais para não duplicar
    const filteredData = { ...data };
    delete filteredData.full_name;
    delete filteredData.email;
    delete filteredData.phone_number;

    return (
        <section>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FontAwesomeIcon icon={faBullhorn} />
                Dados do Formulário Meta
            </h4>
            <div className="space-y-3 p-3 bg-gray-50 border rounded-md">
                {Object.entries(filteredData).map(([key, value]) => (
                    <div key={key}>
                        <dt className="text-xs font-medium text-gray-500 capitalize">
                            {key.replace(/_/g, ' ')}
                        </dt>
                        <dd className="text-sm text-gray-800 font-medium">{value}</dd>
                    </div>
                ))}
            </div>
        </section>
    );
};
// ***** FIM DO NOVO COMPONENTE *****


export default function CrmDetalhesSidebar({ open, onClose, contato, contatoNoFunilId, onAddActivity, onEditActivity, onContactUpdate, refreshKey }) {
    const supabase = createClient();
    const { user } = useAuth();
    const [notes, setNotes] = useState([]);
    const [activities, setActivities] = useState([]);
    const [newNoteContent, setNewNoteContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Estados para edição
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editingNoteContent, setEditingNoteContent] = useState('');

    const initializeEditData = useCallback((c) => {
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

        const { data: notesData, error: notesError } = await supabase.from('crm_notas').select('*, usuarios(nome, sobrenome)').eq('contato_id', contato.id).order('created_at', { ascending: false });
        const { data: activitiesData, error: activitiesError } = await supabase.from('activities').select('*').eq('contato_id', contato.id).order('data_inicio_prevista', { ascending: true });

        if (notesError || activitiesError) {
            toast.error("Erro ao carregar detalhes do contato.");
        } else {
            setNotes(notesData || []);
            setActivities(activitiesData || []);
        }
        setLoading(false);
    }, [contato, supabase]);

    useEffect(() => {
        if (open) {
            fetchData();
            if (contato) {
                initializeEditData(contato);
            }
        } else {
            setIsEditing(false);
        }
    }, [open, contato, fetchData, initializeEditData, refreshKey]);

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        const { nome, razao_social, cpf, cnpj, origem, telefone, email } = editData;
    
        const promise = new Promise(async (resolve, reject) => {
            const { error: contatoError } = await supabase.from('contatos').update({ nome, razao_social, cpf, cnpj, origem }).eq('id', contato.id);
            if (contatoError) return reject(new Error(contatoError.message));
    
            const telefoneId = contato.telefones?.[0]?.id;
            if (telefone) {
                if (telefoneId) { await supabase.from('telefones').update({ telefone }).eq('id', telefoneId); } 
                else { await supabase.from('telefones').insert({ contato_id: contato.id, telefone, tipo: 'Principal' }); }
            }
    
            const emailId = contato.emails?.[0]?.id;
            if (email) {
                if (emailId) { await supabase.from('emails').update({ email }).eq('id', emailId); } 
                else { await supabase.from('emails').insert({ contato_id: contato.id, email, tipo: 'Principal' }); }
            }
            resolve("Contato atualizado com sucesso!");
        });
    
        toast.promise(promise, {
            loading: 'Salvando alterações...',
            success: (msg) => {
                setSaving(false);
                setIsEditing(false);
                onContactUpdate();
                return msg;
            },
            error: (err) => { setSaving(false); return `Erro: ${err.message}`; },
        });
    };

    const handleAddNote = async () => {
        if (!newNoteContent.trim() || !user?.id || !contatoNoFunilId) {
            toast.warning("Não é possível adicionar a nota.");
            return;
        }
        setSaving(true);
        const { error } = await supabase.from('crm_notas').insert({ contato_id: contato.id, conteudo: newNoteContent, usuario_id: user.id, contato_no_funil_id: contatoNoFunilId });
        if (error) { toast.error(`Falha ao adicionar nota: ${error.message}`); } 
        else { toast.success("Nota adicionada."); setNewNoteContent(''); fetchData(); }
        setSaving(false);
    };
    
    const handleCompleteActivity = async (activityId) => {
        const { error } = await supabase.from('activities').update({ status: 'Concluído', data_fim_real: new Date().toISOString() }).eq('id', activityId);
        if (error) { toast.error("Erro ao concluir atividade."); } 
        else { toast.success("Atividade concluída!"); fetchData(); }
    };

    const handleDeleteActivity = async (activityId) => {
        if (window.confirm("Tem certeza que deseja excluir esta atividade?")) {
            const { error } = await supabase.from('activities').delete().eq('id', activityId);
            if (error) { toast.error("Erro ao excluir atividade."); } 
            else { toast.success("Atividade excluída."); fetchData(); }
        }
    };

    const handleStartEditingNote = (note) => {
        setEditingNoteId(note.id);
        setEditingNoteContent(note.conteudo);
    };

    const handleSaveNoteEdit = async (noteId) => {
        if (editingNoteId !== noteId) return;
        setSaving(true);
        const { error } = await supabase.from('crm_notas').update({ conteudo: editingNoteContent }).eq('id', editingNoteId);
        if (error) { toast.error("Erro ao salvar nota."); } 
        else { toast.success("Nota atualizada!"); fetchData(); }
        setEditingNoteId(null);
        setEditingNoteContent('');
        setSaving(false);
    };

    const handleDeleteNote = async (noteId) => {
        if (window.confirm("Tem certeza que deseja excluir esta nota?")) {
            const { error } = await supabase.from('crm_notas').delete().eq('id', noteId);
            if (error) { toast.error("Erro ao excluir a nota."); } 
            else { toast.success("Nota excluída."); fetchData(); }
        }
    };

    if (!open || !contato) return null;

    return (
        <div className="fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out" style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}>
            <div className="flex flex-col h-full">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">{contato.nome || contato.razao_social}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {loading ? ( <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div> ) : (
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
                                            <EditableField label="Nome/Razão Social" value={editData.nome || editData.razao_social} name={contato.personalidade_juridica === 'Pessoa Física' ? 'nome' : 'razao_social'} onChange={handleEditChange} icon={faIdCard} />
                                            <EditableField label="Telefone" value={editData.telefone} name="telefone" onChange={handleEditChange} icon={faPhone} />
                                            <EditableField label="Email" value={editData.email} name="email" onChange={handleEditChange} icon={faEnvelope} />
                                            <EditableField label="CPF/CNPJ" value={editData.cpf || editData.cnpj} name={contato.personalidade_juridica === 'Pessoa Física' ? 'cpf' : 'cnpj'} onChange={handleEditChange} icon={faIdCard} />
                                            <EditableField label="Origem" value={editData.origem} name="origem" onChange={handleEditChange} icon={faGlobe} />
                                        </>
                                    ) : (
                                        <>
                                            <InfoField label="Telefone" value={contato.telefones?.[0]?.telefone} icon={faPhone} />
                                            <InfoField label="Email" value={contato.emails?.[0]?.email} icon={faEnvelope} />
                                            <InfoField label="CPF/CNPJ" value={contato.cpf || contato.cnpj} icon={faIdCard} />
                                            <InfoField label="Origem" value={contato.origem} icon={faGlobe} />
                                        </>
                                    )}
                                </dl>
                            </section>
                            
                            {/* ***** SEÇÃO ADICIONADA ***** */}
                            <MetaFormData data={contato.meta_form_data} />
                            {/* ***** FIM DA SEÇÃO ADICIONADA ***** */}

                            <section>
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-gray-700 flex items-center gap-2"><FontAwesomeIcon icon={faTasks} />Atividades</h4>
                                    <button onClick={() => onAddActivity(contato)} className="text-blue-600 hover:text-blue-800 text-sm font-semibold"><FontAwesomeIcon icon={faPlus} /> Adicionar</button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-50">
                                    {activities.length > 0 ? (
                                        activities.map(act => (
                                            <div key={act.id} className="p-2 bg-white rounded-md text-sm border group">
                                                <p className="font-semibold">{act.nome}</p>
                                                <p className="text-xs text-gray-500">Prazo: {format(new Date(act.data_fim_prevista), 'dd/MM/yy', { locale: ptBR })} - Status: {act.status}</p>
                                                <div className="flex items-center justify-end gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleCompleteActivity(act.id)} title="Marcar como Concluída" className="text-green-500 hover:text-green-700 disabled:text-gray-400" disabled={act.status === 'Concluído'}><FontAwesomeIcon icon={faCheckCircle} /></button>
                                                    <button onClick={() => onEditActivity(act)} title="Editar Atividade" className="text-blue-500 hover:text-blue-700"><FontAwesomeIcon icon={faPen} /></button>
                                                    <button onClick={() => handleDeleteActivity(act.id)} title="Excluir Atividade" className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button>
                                                </div>
                                            </div>
                                        ))
                                    ) : <p className="text-xs text-gray-500 text-center py-4">Nenhuma atividade agendada.</p>}
                                </div>
                            </section>

                            <section>
                                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faStickyNote} />Notas</h4>
                                <div className="space-y-3 max-h-60 overflow-y-auto border rounded-md p-2 bg-gray-50">
                                    {notes.map(note => (
                                        <div key={note.id} className="bg-yellow-50 border-l-4 border-yellow-300 text-sm group">
                                            {editingNoteId === note.id ? (
                                                <div className="p-2">
                                                    <textarea value={editingNoteContent} onChange={(e) => setEditingNoteContent(e.target.value)} autoFocus className="w-full p-1 text-sm border-yellow-400 focus:ring-yellow-500 rounded" rows="3" />
                                                    <div className="text-right mt-1 space-x-2">
                                                        <button onClick={() => setEditingNoteId(null)} className="text-xs font-semibold text-gray-600">Cancelar</button>
                                                        <button onClick={() => handleSaveNoteEdit(note.id)} className="text-xs font-semibold text-blue-600">Salvar</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-2">
                                                    <p className="text-gray-800 whitespace-pre-wrap">{note.conteudo}</p>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <p className="text-xs text-gray-500">- {note.usuarios?.nome} em {format(new Date(note.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</p>
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleStartEditingNote(note)} title="Editar Nota" className="text-blue-500 hover:text-blue-700"><FontAwesomeIcon icon={faPen} size="xs" /></button>
                                                            <button onClick={() => handleDeleteNote(note.id)} title="Excluir Nota" className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} size="xs" /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2">
                                    <textarea value={newNoteContent} onChange={(e) => setNewNoteContent(e.target.value)} placeholder="Adicionar nova nota..." className="w-full p-2 border rounded-md text-sm" rows="2" />
                                    <button onClick={handleAddNote} disabled={saving} className="mt-1 w-full bg-blue-500 text-white py-1 rounded-md text-sm hover:bg-blue-600 disabled:bg-gray-400">
                                        {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar Nota'}
                                    </button>
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}