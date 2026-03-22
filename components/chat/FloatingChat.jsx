"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faTimes, faPaperPlane, faUserFriends, faBullhorn, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import ChatContacts from './ChatContacts';
import ChatRoom from './ChatRoom';
import ChatConversations from './ChatConversations';
import ChatMemoCreate from './ChatMemoCreate';
import ChatMural from './ChatMural';

export default function FloatingChat() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('mensagens');
    
    const [activeView, setActiveView] = useState('list'); // 'list', 'room', ou 'memo_create'
    const [activeRoomUser, setActiveRoomUser] = useState(null);
    
    // Lógica para Botão Arrastável
    const [position, setPosition] = useState({ right: 24, bottom: 24 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef(null);
    const startPos = useRef({ x: 0, y: 0 });

    const handlePointerDown = (e) => {
        if (isOpen) return; 
        e.preventDefault();
        setIsDragging(true);
        startPos.current = { 
            x: e.clientX, 
            y: e.clientY,
            startRight: position.right,
            startBottom: position.bottom
        };
    };

    const handlePointerMove = (e) => {
        if (!isDragging) return;
        const dx = startPos.current.x - e.clientX;
        const dy = startPos.current.y - e.clientY;
        
        let newRight = startPos.current.startRight + dx;
        let newBottom = startPos.current.startBottom + dy;
        
        // Boundaries basicas para nao sumir da tela
        if (newRight < 0) newRight = 0;
        if (newBottom < 0) newBottom = 0;
        if (newRight > window.innerWidth - 60) newRight = window.innerWidth - 60;
        if (newBottom > window.innerHeight - 60) newBottom = window.innerHeight - 60;

        setPosition({ right: newRight, bottom: newBottom });
    };

    const handlePointerUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        } else {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        }
        // Cleanup em desmontagem
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging]);

    const isCorretor = user?.funcoes?.nome_funcao?.toLowerCase().includes('corretor');

    // Regra Ouro: Se for corretor, o chat nem existe no DOM
    if (isCorretor) return null;
    
    // Aguardando carregar usuario logado
    if (!user) return null;

    return (
        <div 
            className="fixed z-[9999] transition-all"
            style={{ 
                right: isOpen ? '24px' : `${position.right}px`, 
                bottom: isOpen ? '24px' : `${position.bottom}px`,
                // Remove a animacao CSS durante o arraste para ficar liso acompanhando o mouse
                transitionDuration: isDragging ? '0ms' : '300ms'
            }}
        >
            {!isOpen ? (
                <div 
                    ref={dragRef}
                    onPointerDown={handlePointerDown}
                    onClick={() => {
                        // So abre a caixa se nao foi um movimento de arrastar solto
                        if (!isDragging) setIsOpen(true);
                    }}
                    className={`w-14 h-14 bg-gradient-to-r from-gray-900 to-black text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 ${isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab'}`}
                    title="Comunicação e Memorandos"
                >
                    <FontAwesomeIcon icon={faComments} className="text-2xl drop-shadow-md" />
                </div>
            ) : (
                <div className="w-[380px] h-[650px] max-h-[85vh] bg-white/70 backdrop-blur-2xl border border-white/50 shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {/* Header Premium dinâmico */}
                    <div className="h-16 bg-gradient-to-r from-gray-900 to-black text-white flex items-center justify-between px-5 shrink-0">
                        <div className="flex items-center gap-3 w-full">
                            {activeView === 'room' ? (
                                <>
                                    <button onClick={() => setActiveView('list')} className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors mr-1 shrink-0">
                                        <FontAwesomeIcon icon={faArrowLeft} />
                                    </button>
                                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-white/10">
                                        {activeRoomUser?.avatar_url ? (
                                            <img src={activeRoomUser.avatar_url} className="w-full h-full object-cover"/>
                                        ) : (
                                            <FontAwesomeIcon icon={faComments} className="text-sm" />
                                        )}
                                    </div>
                                    <div className="flex flex-col overflow-hidden w-full">
                                        <h3 className="font-medium text-[15px] tracking-wide truncate">{activeRoomUser?.nome || 'Chat'}</h3>
                                        <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest mt-[-2px]">Online</span>
                                    </div>
                                </>
                            ) : activeView === 'memo_create' ? (
                                <>
                                    <button onClick={() => setActiveView('list')} className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors mr-1 shrink-0">
                                        <FontAwesomeIcon icon={faArrowLeft} />
                                    </button>
                                    <div className="flex flex-col overflow-hidden w-full">
                                        <h3 className="font-medium text-[15px] tracking-wide truncate">Novo Memorando</h3>
                                        <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mt-[-2px]">Transmissão Lote</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center shrink-0 border border-white/10">
                                        <FontAwesomeIcon icon={faComments} className="text-sm" />
                                    </div>
                                    <h3 className="font-medium text-md tracking-wide">Comunicação Elo 57</h3>
                                </>
                            )}
                        </div>
                        {activeView === 'list' && (
                            <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors text-gray-300 hover:text-white shrink-0">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        )}
                    </div>

                    {/* Controle de Views: Listagem, Memo ou Sala de Chat */}
                    {activeView === 'list' ? (
                        <>
                            {/* Abas */}
                            <div className="flex bg-white/40 backdrop-blur-md border-b border-gray-200 shrink-0">
                                <button 
                                    onClick={() => setActiveTab('mensagens')}
                                    className={`flex-1 py-3 text-[13px] font-medium border-b-2 transition-colors ${activeTab === 'mensagens' ? 'border-indigo-600 text-indigo-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                    Mensagens
                                </button>
                                <button 
                                    onClick={() => setActiveTab('contatos')}
                                    className={`flex-1 py-3 text-[13px] font-medium border-b-2 transition-colors ${activeTab === 'contatos' ? 'border-indigo-600 text-indigo-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                    Contatos
                                </button>
                                <button 
                                    onClick={() => setActiveTab('mural')}
                                    className={`flex-1 py-3 text-[13px] font-medium border-b-2 transition-colors ${activeTab === 'mural' ? 'border-indigo-600 text-indigo-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                                    Mural
                                </button>
                            </div>

                            {/* Conteúdo Dinâmico */}
                            <div className="flex-1 overflow-y-auto flex flex-col bg-white/50">
                                {activeTab === 'mural' ? (
                                    <ChatMural />
                                ) : activeTab === 'mensagens' ? (
                                    <ChatConversations onSelectConversation={(contact) => {
                                        setActiveRoomUser(contact);
                                        setActiveView('room');
                                    }} />
                                ) : (
                                    <ChatContacts onSelectContact={(contact) => {
                                        if (contact.isBroadcast) {
                                            setActiveView('memo_create');
                                        } else {
                                            setActiveRoomUser(contact);
                                            setActiveView('room');
                                        }
                                    }} />
                                )}
                            </div>
                        </>
                    ) : activeView === 'memo_create' ? (
                        <ChatMemoCreate onDone={() => {
                            setActiveTab('mensagens');
                            setActiveView('list');
                        }} />
                    ) : (
                        <ChatRoom contact={activeRoomUser} />
                    )}
                </div>
            )}
        </div>
    );
}
