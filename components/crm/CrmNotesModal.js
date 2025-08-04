// components/crm/CrmNotesModal.js
"use client";

import { useState, useEffect, useCallback } from 'react'; // Importar useCallback
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faSpinner, faStickyNote } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CrmNotesModal({ isOpen, onClose, contatoNoFunilId, contatoId }) {
    const { user } = useAuth();
    const [notes, setNotes] = useState([]);
    const [newNoteContent, setNewNoteContent] = useState('');
    const [isLoadingNotes, setIsLoadingNotes] = useState(true);
    const [isSavingNote, setIsSavingNote] = useState(false);

    // CORREÇÃO: A função foi envolvida em useCallback
    const fetchNotes = useCallback(async () => {
        if (!contatoNoFunilId || !isOpen) {
            setNotes([]);
            setIsLoadingNotes(false);
            return;
        }
        setIsLoadingNotes(true);
        try {
            const response = await fetch(`/api/crm?context=notes&contatoNoFunilId=${contatoNoFunilId}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Erro ao buscar notas.");
            }
            setNotes(result);
        } catch (error) {
            console.error("Erro ao buscar notas:", error);
            toast.error(`Não foi possível carregar as notas. Detalhes: ${error.message}`);
        } finally {
            setIsLoadingNotes(false);
        }
    }, [contatoNoFunilId, isOpen]); // Dependências do useCallback

    // CORREÇÃO: Adicionada a dependência 'fetchNotes'
    useEffect(() => {
        fetchNotes();
    }, [isOpen, contatoNoFunilId, fetchNotes]);

    const handleAddNote = async () => {
        if (!newNoteContent.trim() || isSavingNote || !user?.id) return;

        setIsSavingNote(true);
        try {
            const payload = {
                action: 'createNote',
                contato_no_funil_id: contatoNoFunilId,
                contato_id: contatoId,
                conteudo: newNoteContent,
                usuario_id: user.id
            };

            const response = await fetch('/api/crm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Erro ao adicionar nota.");
            }
            
            setNewNoteContent('');
            toast.success('Nota adicionada com sucesso!');
            fetchNotes();
        } catch (error) {
            console.error("Erro ao adicionar nota:", error);
            toast.error(`Não foi possível adicionar a nota. Detalhes: ${error.message}`);
        } finally {
            setIsSavingNote(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h3 className="text-xl font-bold text-gray-800">Notas do Contato <FontAwesomeIcon icon={faStickyNote} className="ml-2 text-blue-500"/></h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                <div className="mb-4">
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        rows="3"
                        placeholder="Adicione uma nova nota..."
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        disabled={isSavingNote}
                    ></textarea>
                    <div className="flex justify-end mt-2">
                        <button
                            onClick={handleAddNote}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center text-sm"
                            disabled={isSavingNote || !newNoteContent.trim()}
                        >
                            {isSavingNote ? (
                                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                            ) : (
                                <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                            )}
                            {isSavingNote ? "Salvando..." : "Adicionar Nota"}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {isLoadingNotes ? (
                        <div className="flex justify-center items-center h-full">
                            <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" />
                            <span className="ml-3 text-gray-600">Carregando notas...</span>
                        </div>
                    ) : notes.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">Nenhuma nota encontrada para este contato.</p>
                    ) : (
                        <div className="space-y-4">
                            {notes.map((note) => (
                                <div key={note.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                                    <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{note.conteudo}</p>
                                    <div className="mt-2 text-right text-xs text-gray-500">
                                        Por <span className="font-semibold">{note.usuarios?.nome || 'Desconhecido'} {note.usuarios?.sobrenome || ''}</span> em {format(new Date(note.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}