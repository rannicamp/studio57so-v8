"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useChatContacts } from './ChatHooks';
import { useAuth } from '@/contexts/AuthContext';

export default function ChatContacts({ onSelectContact }) {
 const { user } = useAuth();
 const { data: contacts, isLoading, error } = useChatContacts();

 if (isLoading) {
 return (
 <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
 <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-2" />
 <p className="text-sm">Carregando contatos...</p>
 </div>
 );
 }

 if (error) {
 return (
 <div className="flex-1 p-4 text-center text-red-500 text-sm">
 Ocorreu um erro ao carregar os usuários deste ambiente.
 </div>
 );
 }

 // Retira o proprio usuario logado da lista
 const filteredContacts = contacts?.filter(c => c.id !== user?.id) || [];

 if (filteredContacts.length === 0) {
 return (
 <div className="flex-1 p-4 text-center text-gray-500 text-sm flex items-center justify-center">
 Você é o único membro administrativo no momento.
 </div>
 );
 }

 return (
 <div className="flex-1 overflow-y-auto w-full p-2 space-y-1">
 {/* Opcao de Memorando Global */}
 <div onClick={() => onSelectContact({ isBroadcast: true })}
 className="flex items-center gap-3 p-3 hover:bg-gray-100/80 rounded-xl cursor-pointer transition-colors mb-2 bg-indigo-50/50 border border-indigo-100"
 >
 <div className="w-10 h-10 rounded-full bg-blue-600 from-indigo-500 flex items-center justify-center text-white font-bold shadow-sm">
 M
 </div>
 <div className="flex-1 overflow-hidden">
 <h4 className="text-sm font-semibold text-indigo-900 truncate">Novo Memorando</h4>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="text-[11px] text-indigo-500/80 uppercase font-semibold">Lista de Transmissão</span>
 </div>
 </div>
 </div>

 <div className="px-3 pb-2 pt-1 font-semibold text-xs tracking-wider text-gray-400 uppercase">Equipe</div>

 {filteredContacts.map(contact => {
 const fullName = contact.sobrenome ? `${contact.nome} ${contact.sobrenome}` : contact.nome;
 const displayName = fullName || contact.email;
 const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';
 const role = contact.funcoes?.nome_funcao || 'Administrativo';
 return (
 <div key={contact.id}
 onClick={() => onSelectContact(contact)}
 className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors group"
 >
 {/* Avatar */}
 {contact.avatar_url ? (
 <img src={contact.avatar_url} alt={displayName} className="w-10 h-10 rounded-full object-cover shadow-sm bg-white" />
 ) : (
 <div className="w-10 h-10 rounded-full bg-blue-600 text-white to-black flex items-center justify-center text-white font-bold shadow-sm group-hover:shadow-md transition-all">
 {initial}
 </div>
 )}
 {/* Info */}
 <div className="flex-1 overflow-hidden">
 <h4 className="text-sm font-semibold text-gray-800 truncate">{displayName}</h4>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="px-2 py-[2px] rounded text-[9px] font-bold bg-gray-200 text-gray-600 tracking-wider uppercase">
 {role}
 </span>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 );
}
