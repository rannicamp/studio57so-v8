"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faSpinner, faCheckSquare, faSquare } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useChatContacts, useSendBroadcast } from './ChatHooks';

export default function ChatMemoCreate({ onDone }) {
 const { user } = useAuth();
 const { data: contacts = [], isLoading } = useChatContacts();
 const sendBroadcastMutation = useSendBroadcast();
 const [selectedIds, setSelectedIds] = useState([]);
 const [mensagem, setMensagem] = useState('');

 const filteredContacts = contacts.filter(c => c.id !== user?.id) || [];

 const toggleContact = (id) => {
 if (selectedIds.includes(id)) {
 setSelectedIds(selectedIds.filter(x => x !== id));
 } else {
 setSelectedIds([...selectedIds, id]);
 }
 };

 const handleSend = (e) => {
 e.preventDefault();
 if (selectedIds.length === 0 || !mensagem.trim()) return;

 sendBroadcastMutation.mutate({
 userIds: selectedIds,
 conteudo: mensagem.trim()
 }, {
 onSuccess: () => {
 alert("Memorando enviado com sucesso para " + selectedIds.length + " destinatários!");
 onDone();
 },
 onError: (err) => {
 alert("Falha ao enviar memorando: " + (err.message || String(err)));
 }
 });
 };

 if (isLoading) {
 return (
 <div className="flex-1 flex flex-col items-center justify-center p-4">
 <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-400 mb-2" />
 </div>
 );
 }

 return (
 <div className="flex-1 flex flex-col bg-white overflow-hidden h-full">
 {/* Lista de Seleção */}
 <div className="p-3 bg-indigo-50 border-b border-indigo-100 text-sm text-indigo-800 font-medium">
 Selecione os destinatários ({selectedIds.length})
 </div>
 <div className="flex-1 overflow-y-auto p-2 space-y-1">
 {filteredContacts.map(contact => {
 const fullName = contact.sobrenome ? `${contact.nome} ${contact.sobrenome}` : contact.nome;
 const displayName = fullName || contact.email;
 const initial = displayName.charAt(0).toUpperCase();
 const isSelected = selectedIds.includes(contact.id);
 return (
 <div key={contact.id}
 onClick={() => toggleContact(contact.id)}
 className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-gray-50 border-transparent'}`}
 >
 <div className="shrink-0 text-indigo-500">
 <FontAwesomeIcon icon={isSelected ? faCheckSquare : faSquare} className={isSelected ? 'text-indigo-600' : 'text-gray-300'} />
 </div>
 {contact.avatar_url ? (
 <img src={contact.avatar_url} alt={displayName} className="w-10 h-10 rounded-full object-cover shadow-sm bg-white shrink-0" />
 ) : (
 <div className="w-10 h-10 shrink-0 rounded-full bg-blue-600 text-white to-black flex items-center justify-center text-white font-bold shadow-sm">
 {initial}
 </div>
 )}
 <div className="flex-1 overflow-hidden">
 <h4 className="text-sm font-semibold text-gray-800 truncate">{displayName}</h4>
 <span className="text-[10.5px] font-medium tracking-wide uppercase text-gray-400">{contact.funcoes?.nome_funcao || 'Administrativo'}</span>
 </div>
 </div>
 );
 })}
 </div>

 {/* Input Memorando */}
 <div className="p-3 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
 <form onSubmit={handleSend} className="flex flex-col gap-2">
 <textarea value={mensagem}
 onChange={(e) => setMensagem(e.target.value)}
 placeholder="Escreva a mensagem do memorando para a equipe..."
 className="w-full h-24 bg-gray-50 border border-gray-200 rounded-xl p-3 text-[14.5px] resize-none outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
 />
 <button type="submit"
 disabled={selectedIds.length === 0 || !mensagem.trim() || sendBroadcastMutation.isPending}
 className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-md hover:bg-indigo-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
 >
 {sendBroadcastMutation.isPending ? (
 <FontAwesomeIcon icon={faSpinner} spin />
 ) : (
 <>
 <FontAwesomeIcon icon={faPaperPlane} />
 Disparar Memorando
 </>
 )}
 </button>
 </form>
 </div>
 </div>
 );
}
