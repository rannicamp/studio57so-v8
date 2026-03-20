'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch, faEnvelope, faSpinner, faPaperPlane,
    faArrowLeft, faRotateRight, faCircle
} from '@fortawesome/free-solid-svg-icons';
import { faInstagram, faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { useDebounce } from 'use-debounce';
import { toast } from 'sonner';

const INSTA_UI_STATE_KEY = 'instagramUiState';

const getCachedData = () => {
    if (typeof window === 'undefined') return null;
    try {
        const d = localStorage.getItem(INSTA_UI_STATE_KEY);
        return d ? JSON.parse(d) : null;
    } catch { return null; }
};

// Formata o tempo relativo (ex: "há 5 min")
function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

// Avatar com iniciais
function Avatar({ name, picUrl, size = 10 }) {
    const [imgError, setImgError] = useState(false);
    const initials = name ? name.charAt(0).toUpperCase() : '?';

    if (picUrl && !imgError) {
        return (
            <img
                src={picUrl}
                alt={name}
                onError={() => setImgError(true)}
                className={`w-${size} h-${size} rounded-full object-cover shrink-0`}
            />
        );
    }
    return (
        <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-purple-500 to-orange-400 flex items-center justify-center text-white font-bold shrink-0`}
            style={{ fontSize: size * 1.6 + 'px' }}>
            {initials}
        </div>
    );
}

// Item da lista de conversas
function ConversationItem({ conv, isSelected, onClick }) {
    return (
        <button
            onClick={() => onClick(conv)}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors border-b border-gray-100 text-left ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
        >
            <div className="relative shrink-0">
                <Avatar name={conv.participant_name} picUrl={conv.participant_profile_pic} size={11} />
                {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-gradient-to-br from-purple-500 to-orange-400 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {conv.unread_count}
                    </span>
                )}
            </div>
            <div className="flex-grow min-w-0">
                <div className="flex justify-between items-baseline">
                    <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {conv.participant_name}
                    </p>
                    <span className="text-[11px] text-gray-400 shrink-0 ml-2">
                        {formatRelativeTime(conv.last_message_at)}
                    </span>
                </div>
                {conv.participant_username && (
                    <p className="text-[11px] text-purple-500">@{conv.participant_username}</p>
                )}
                <p className="text-xs text-gray-500 truncate mt-0.5">{conv.snippet || 'Sem mensagens'}</p>
            </div>
        </button>
    );
}

// Painel de mensagens
function MessagePanel({ conv, organizacaoId, onBack }) {
    const [text, setText] = useState('');
    const messagesEndRef = useRef(null);
    const queryClient = useQueryClient();

    const { data: messages = [], isLoading } = useQuery({
        queryKey: ['instagramMessages', conv.id],
        queryFn: async () => {
            const res = await fetch(`/api/instagram/messages?conversation_id=${conv.id}`);
            if (!res.ok) throw new Error('Falha ao buscar mensagens');
            return res.json();
        },
        enabled: !!conv.id,
        refetchInterval: 10000, // atualiza a cada 10s
    });

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMutation = useMutation({
        mutationFn: async (messageText) => {
            const res = await fetch('/api/instagram/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organizacao_id: organizacaoId,
                    conversation_id: conv.id,
                    recipient_id: conv.participant_id,
                    text: messageText,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao enviar');
            }
            return res.json();
        },
        onSuccess: () => {
            setText('');
            queryClient.invalidateQueries({ queryKey: ['instagramMessages', conv.id] });
            queryClient.invalidateQueries({ queryKey: ['instagramConversations', organizacaoId] });
        },
        onError: (err) => toast.error(`Erro: ${err.message}`),
    });

    const handleSend = () => {
        if (!text.trim() || sendMutation.isPending) return;
        sendMutation.mutate(text.trim());
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header do chat */}
            <div className="h-16 bg-white border-b flex items-center px-4 gap-3 shrink-0 shadow-sm">
                <button onClick={onBack} className="md:hidden text-gray-500 hover:text-gray-700 mr-1">
                    <FontAwesomeIcon icon={faArrowLeft} />
                </button>
                <Avatar name={conv.participant_name} picUrl={conv.participant_profile_pic} size={10} />
                <div>
                    <p className="font-bold text-gray-800 text-sm">{conv.participant_name}</p>
                    {conv.participant_username && (
                        <p className="text-xs text-purple-500">@{conv.participant_username}</p>
                    )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <FontAwesomeIcon icon={faInstagram} className="text-xl text-transparent bg-clip-text"
                        style={{ color: '#e1306c' }} />
                </div>
            </div>

            {/* Área de mensagens */}
            <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-purple-400 text-2xl" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full text-gray-400 text-sm">
                        Nenhuma mensagem ainda.
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOut = msg.direction === 'outbound';
                        return (
                            <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm shadow-sm ${isOut
                                    ? 'bg-gradient-to-br from-purple-500 to-orange-400 text-white rounded-tr-sm'
                                    : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                                    }`}>
                                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                    <p className={`text-[10px] mt-1 ${isOut ? 'text-white/70 text-right' : 'text-gray-400'}`}>
                                        {formatRelativeTime(msg.sent_at)}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input de resposta */}
            <div className="bg-white border-t p-3 flex items-end gap-2 shrink-0">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite uma mensagem..."
                    rows={1}
                    className="flex-grow resize-none rounded-2xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50 max-h-32 overflow-y-auto"
                    style={{ lineHeight: '1.5' }}
                />
                <button
                    onClick={handleSend}
                    disabled={!text.trim() || sendMutation.isPending}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-orange-400 text-white flex items-center justify-center shadow-md transition-opacity disabled:opacity-50 shrink-0"
                >
                    {sendMutation.isPending
                        ? <FontAwesomeIcon icon={faSpinner} spin className="text-sm" />
                        : <FontAwesomeIcon icon={faPaperPlane} className="text-sm" />
                    }
                </button>
            </div>
        </div>
    );
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function InstagramInbox({ onChangeTab }) {
    const cachedState = getCachedData();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const supabase = createClient();
    const queryClient = useQueryClient();

    const [selectedConv, setSelectedConv] = useState(cachedState?.selectedConv || null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    const [debouncedUiState] = useDebounce({ selectedConv }, 1000);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try { localStorage.setItem(INSTA_UI_STATE_KEY, JSON.stringify(debouncedUiState)); } catch { }
        }
    }, [debouncedUiState]);

    // Busca as conversas salvas no banco
    const { data: conversations = [], isLoading } = useQuery({
        queryKey: ['instagramConversations', organizacaoId],
        queryFn: async () => {
            const res = await fetch(`/api/instagram/conversations?organizacao_id=${organizacaoId}`);
            if (!res.ok) throw new Error('Falha ao buscar conversas');
            return res.json();
        },
        enabled: !!organizacaoId,
        refetchOnWindowFocus: true,
    });

    // Realtime: atualiza ao receber nova mensagem
    useEffect(() => {
        if (!organizacaoId) return;
        const channel = supabase.channel('instagram-realtime')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'instagram_conversations', filter: `organizacao_id=eq.${organizacaoId}` },
                () => queryClient.invalidateQueries({ queryKey: ['instagramConversations', organizacaoId] })
            )
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'instagram_messages', filter: `organizacao_id=eq.${organizacaoId}` },
                (payload) => {
                    queryClient.invalidateQueries({ queryKey: ['instagramConversations', organizacaoId] });
                    if (selectedConv && payload.new.conversation_id === selectedConv.id) {
                        queryClient.invalidateQueries({ queryKey: ['instagramMessages', selectedConv.id] });
                    }
                }
            )
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [organizacaoId, queryClient, selectedConv]);

    // Sincronizar com a Meta manualmente
    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/instagram/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ organizacao_id: organizacaoId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro na sincronização');
            toast.success(`✅ ${data.synced} conversa(s) sincronizada(s)!`);
            queryClient.invalidateQueries({ queryKey: ['instagramConversations', organizacaoId] });
        } catch (err) {
            toast.error(`Erro: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const filteredConvs = conversations.filter(c =>
        (c.participant_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.participant_username || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const hasSelection = !!selectedConv;

    return (
        <div className="flex h-full w-full overflow-hidden bg-white">
            {/* ─── COLUNA ESQUERDA (Lista de conversas) ─── */}
            <div className={`
                ${hasSelection ? 'hidden md:flex' : 'flex'}
                w-full md:w-[350px] shrink-0 flex-col border-r bg-white h-full overflow-hidden min-h-0
            `}>
                {/* Seletor de canal */}
                <div className="flex border-b bg-gray-50 shrink-0">
                    {onChangeTab && (
                        <>
                            <button onClick={() => onChangeTab('whatsapp')} className="flex-1 py-3 text-xs font-medium flex justify-center items-center gap-1.5 border-b-2 border-transparent text-gray-500 hover:bg-gray-100 transition-colors">
                                <FontAwesomeIcon icon={faWhatsapp} className="text-base" /> WhatsApp
                            </button>
                            <button onClick={() => onChangeTab('email')} className="flex-1 py-3 text-xs font-medium flex justify-center items-center gap-1.5 border-b-2 border-transparent text-gray-500 hover:bg-gray-100 transition-colors">
                                <FontAwesomeIcon icon={faEnvelope} className="text-base" /> E-mail
                            </button>
                        </>
                    )}
                    <button className="flex-1 py-3 text-xs font-bold flex justify-center items-center gap-1.5 border-b-2 border-[#e1306c] text-[#e1306c] bg-white transition-colors">
                        <FontAwesomeIcon icon={faInstagram} className="text-base" /> Instagram
                    </button>
                </div>

                {/* Header com busca e sync */}
                <div className="h-16 border-b flex items-center gap-2 px-3 bg-white shrink-0">
                    <div className="relative flex-grow">
                        <input
                            type="text"
                            placeholder="Pesquisar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 text-sm"
                        />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    </div>
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        title="Sincronizar conversas da Meta"
                        className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50 shrink-0"
                    >
                        <FontAwesomeIcon icon={faRotateRight} className={isSyncing ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Lista */}
                <div className="flex-grow overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-32">
                            <FontAwesomeIcon icon={faSpinner} spin className="text-purple-400 text-2xl" />
                        </div>
                    ) : filteredConvs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-400">
                            <FontAwesomeIcon icon={faInstagram} className="text-5xl mb-4" style={{ color: '#e1306c', opacity: 0.3 }} />
                            <p className="text-sm font-medium text-gray-500">Nenhuma conversa ainda</p>
                            <p className="text-xs mt-1">Clique em 🔄 para sincronizar</p>
                        </div>
                    ) : (
                        filteredConvs.map(conv => (
                            <ConversationItem
                                key={conv.id}
                                conv={conv}
                                isSelected={selectedConv?.id === conv.id}
                                onClick={setSelectedConv}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* ─── ÁREA PRINCIPAL (Chat ou Empty State) ─── */}
            <div className={`
                ${hasSelection ? 'flex' : 'hidden md:flex'}
                flex-grow flex-col h-full overflow-hidden min-h-0
            `}>
                {selectedConv ? (
                    <MessagePanel
                        conv={selectedConv}
                        organizacaoId={organizacaoId}
                        onBack={() => setSelectedConv(null)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-6">
                        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-10 max-w-md text-center">
                            {/* Ícone do Instagram com gradiente */}
                            <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
                                <FontAwesomeIcon icon={faInstagram} className="text-5xl text-white" />
                            </div>
                            <h2 className="text-2xl font-extrabold text-gray-800 mb-3">Mensagens do Instagram</h2>
                            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                                Selecione uma conversa ao lado para responder diretamente pelo CRM, sem precisar abrir o Instagram.
                            </p>
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className="w-full py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                                style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}
                            >
                                <FontAwesomeIcon icon={faRotateRight} className={isSyncing ? 'animate-spin' : ''} />
                                {isSyncing ? 'Sincronizando...' : 'Sincronizar Conversas'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
