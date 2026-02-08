// components/crm/CrmNotesModal.js
"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faSpinner, faStickyNote } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // Imports atualizados
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// =================================================================================
// ATUALIZAÇÃO DE PADRÃO E SEGURANÇA
// O PORQUÊ: Esta função agora busca os dados para o useQuery e envia o
// `organizacaoId` para a API, garantindo que apenas as notas da
// organização correta sejam retornadas.
// =================================================================================
const fetchNotes = async (contatoNoFunilId, organizacaoId) => {
    if (!contatoNoFunilId || !organizacaoId) return [];

    const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'getNotes',
            contatoNoFunilId,
            organizacaoId, // <-- Enviando a "chave mestra" de segurança
        }),
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || "Erro ao buscar notas.");
    }
    return result;
};

export default function CrmNotesModal({ isOpen, onClose, contatoNoFunilId, contatoId }) {
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();

    const [newNoteContent, setNewNoteContent] = useState('');

    // =================================================================================
    // ATUALIZAÇÃO DE PADRÃO (useState + useEffect -> useQuery)
    // O PORQUÊ: Substituímos a lógica antiga por useQuery. Ele gerencia o loading,
    // erros e o cache dos dados de forma automática.
    // =================================================================================
    const { data: notes = [], isLoading: isLoadingNotes, isError, error } = useQuery({
        queryKey: ['crmNotes', contatoNoFunilId, organizacaoId],
        queryFn: () => fetchNotes(contatoNoFunilId, organizacaoId),
        enabled: isOpen && !!contatoNoFunilId && !!organizacaoId,
    });
    
    // =================================================================================
    // ATUALIZAÇÃO DE PADRÃO E SEGURANÇA (useMutation)
    // O PORQUÊ: Encapsulamos a lógica de criação em um `useMutation`.
    // O payload agora inclui o `organizacaoId` para garantir que a nova nota
    // seja "etiquetada" corretamente.
    // =================================================================================
    const addNoteMutation = useMutation({
        mutationFn: async (conteudo) => {
            if (!conteudo.trim() || !user?.id || !organizacaoId) {
                throw new Error("Dados insuficientes para criar a nota.");
            }
            const payload = {
                action: 'createNote',
                contato_no_funil_id: contatoNoFunilId,
                contato_id: contatoId,
                conteudo,
                usuario_id: user.id,
                organizacao_id: organizacaoId, // <-- ETIQUETA DE SEGURANÇA!
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
            return result;
        },
        onSuccess: () => {
            setNewNoteContent('');
            // Invalida a query para forçar o useQuery a buscar os dados novamente
            queryClient.invalidateQueries({ queryKey: ['crmNotes', contatoNoFunilId, organizacaoId] });
        },
    });

    const handleAddNote = () => {
        toast.promise(addNoteMutation.mutateAsync(newNoteContent), {
            loading: 'Salvando nota...',
            success: 'Nota adicionada com sucesso!',
            error: (err) => `Erro ao salvar: ${err.message}`,
        });
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
                        disabled={addNoteMutation.isPending}
                    ></textarea>
                    <div className="flex justify-end mt-2">
                        <button
                            onClick={handleAddNote}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center text-sm disabled:bg-gray-400"
                            disabled={addNoteMutation.isPending || !newNoteContent.trim()}
                        >
                            {addNoteMutation.isPending ? (
                                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                            ) : (
                                <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                            )}
                            {addNoteMutation.isPending ? "Salvando..." : "Adicionar Nota"}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {isLoadingNotes ? (
                        <div className="flex justify-center items-center h-full">
                            <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" />
                            <span className="ml-3 text-gray-600">Carregando notas...</span>
                        </div>
                    ) : isError ? (
                        <p className="text-center text-red-500 py-8">{error.message}</p>
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