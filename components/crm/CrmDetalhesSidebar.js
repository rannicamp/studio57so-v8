// components/crm/CrmDetalhesSidebar.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faStickyNote, faTasks, faSpinner, faPlus, faPhone, faEnvelope, faIdCard, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Componente simples para exibir um campo de informação
const InfoField = ({ label, value, icon }) => (
    <div>
        <dt className="text-xs font-medium text-gray-500 flex items-center gap-2">
            <FontAwesomeIcon icon={icon} />
            {label}
        </dt>
        <dd className="mt-1 text-sm text-gray-900">{value || 'N/A'}</dd>
    </div>
);

export default function CrmDetalhesSidebar({ open, onClose, contato, onAddActivity }) {
    const supabase = createClient();
    const { user } = useAuth();
    const [notes, setNotes] = useState([]);
    const [activities, setActivities] = useState([]);
    const [newNoteContent, setNewNoteContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingNote, setSavingNote] = useState(false);

    const fetchData = useCallback(async () => {
        if (!contato?.id) return;
        setLoading(true);

        const { data: notesData, error: notesError } = await supabase
            .from('crm_notas')
            .select('*, usuarios(nome, sobrenome)')
            .eq('contato_id', contato.id)
            .order('created_at', { ascending: false });
        
        const { data: activitiesData, error: activitiesError } = await supabase
            .from('activities')
            .select('*')
            .eq('contato_id', contato.id)
            .order('data_inicio_prevista', { ascending: true });

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
        }
    }, [open, fetchData]);

    const handleAddNote = async () => {
        if (!newNoteContent.trim() || !user?.id) return;
        setSavingNote(true);
        
        const { error } = await supabase.from('crm_notas').insert({
            contato_id: contato.id,
            conteudo: newNoteContent,
            usuario_id: user.id
        });

        if (error) {
            toast.error("Falha ao adicionar nota.");
        } else {
            toast.success("Nota adicionada.");
            setNewNoteContent('');
            fetchData();
        }
        setSavingNote(false);
    };

    if (!open || !contato) return null;

    return (
        <div className="fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out"
             style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}>
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">{contato.nome || contato.razao_social}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {loading ? (
                        <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                    ) : (
                        <>
                            <section>
                                <h4 className="font-semibold mb-3 text-gray-700">Detalhes do Contato</h4>
                                <dl className="grid grid-cols-2 gap-y-4 gap-x-2">
                                    <InfoField label="Telefone" value={contato.telefones?.[0]?.telefone} icon={faPhone} />
                                    <InfoField label="Email" value={contato.emails?.[0]?.email} icon={faEnvelope} />
                                    <InfoField label="CPF/CNPJ" value={contato.cpf || contato.cnpj} icon={faIdCard} />
                                    <InfoField label="Origem" value={contato.origem} icon={faGlobe} />
                                </dl>
                            </section>

                            <section>
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-gray-700 flex items-center gap-2"><FontAwesomeIcon icon={faTasks} />Atividades</h4>
                                    <button onClick={() => onAddActivity(contato)} className="text-blue-600 hover:text-blue-800 text-sm font-semibold"><FontAwesomeIcon icon={faPlus} /> Adicionar</button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-50">
                                    {activities.length > 0 ? (
                                        activities.map(act => (
                                            <div key={act.id} className="p-2 bg-white rounded-md text-sm border">
                                                <p className="font-semibold">{act.nome}</p>
                                                <p className="text-xs text-gray-500">Prazo: {format(new Date(act.data_fim_prevista), 'dd/MM/yy', { locale: ptBR })} - Status: {act.status}</p>
                                            </div>
                                        ))
                                    ) : <p className="text-xs text-gray-500 text-center py-4">Nenhuma atividade agendada.</p>}
                                </div>
                            </section>

                            <section>
                                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faStickyNote} />Notas</h4>
                                <div className="space-y-3 max-h-60 overflow-y-auto border rounded-md p-2 bg-gray-50">
                                    {notes.map(note => (
                                        <div key={note.id} className="p-2 bg-yellow-50 border-l-4 border-yellow-300 text-sm">
                                            <p className="text-gray-800 whitespace-pre-wrap">{note.conteudo}</p>
                                            <p className="text-xs text-gray-500 mt-1 text-right">
                                                - {note.usuarios?.nome} em {format(new Date(note.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2">
                                    <textarea
                                        value={newNoteContent}
                                        onChange={(e) => setNewNoteContent(e.target.value)}
                                        placeholder="Adicionar nova nota..."
                                        className="w-full p-2 border rounded-md text-sm"
                                        rows="2"
                                    />
                                    <button onClick={handleAddNote} disabled={savingNote} className="mt-1 w-full bg-blue-500 text-white py-1 rounded-md text-sm hover:bg-blue-600 disabled:bg-gray-400">
                                        {savingNote ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar Nota'}
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