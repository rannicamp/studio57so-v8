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
 <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
 <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
 {/* Header azul padrão */}
 <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white flex-shrink-0">
 <h3 className="text-base font-bold flex items-center gap-2">
 <FontAwesomeIcon icon={faStickyNote} /> Notas do Contato
 </h3>
 <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10" title="Fechar">
 <FontAwesomeIcon icon={faTimes} />
 </button>
 </div>

 <div className="p-6 space-y-4 flex flex-col flex-1 overflow-hidden">
 <div>
 <textarea
 className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm font-medium resize-none"
 rows="3"
 placeholder="Adicione uma nova nota..."
 value={newNoteContent}
 onChange={(e) => setNewNoteContent(e.target.value)}
 disabled={addNoteMutation.isPending}
 ></textarea>
 <div className="flex justify-end mt-2">
 <button
 onClick={handleAddNote}
 className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-bold disabled:bg-gray-300 disabled:cursor-not-allowed"
 disabled={addNoteMutation.isPending || !newNoteContent.trim()}
 >
 {addNoteMutation.isPending ? (
 <FontAwesomeIcon icon={faSpinner} spin />
 ) : (
 <FontAwesomeIcon icon={faPaperPlane} />
 )}
 {addNoteMutation.isPending ? "Salvando..." : "Adicionar Nota"}
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto pr-1">
 {isLoadingNotes ? (
 <div className="flex justify-center items-center h-32 gap-3">
 <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" />
 <span className="text-sm text-gray-500 font-medium">Carregando notas...</span>
 </div>
 ) : isError ? (
 <p className="text-center text-red-500 py-8 text-sm">{error.message}</p>
 ) : notes.length === 0 ? (
 <p className="text-center text-gray-400 py-8 text-sm font-medium">Nenhuma nota encontrada para este contato.</p>
 ) : (
 <div className="space-y-3">
 {notes.map((note) => (
 <div key={note.id} className="bg-gray-50 p-4 rounded-md border border-gray-200">
 <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{note.conteudo}</p>
 <div className="mt-2 text-right text-xs text-gray-500">
 Por <span className="font-medium">{note.usuarios?.nome || 'Desconhecido'} {note.usuarios?.sobrenome || ''}</span> em {format(new Date(note.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
