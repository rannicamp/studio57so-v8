'use client'

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTimes, faExternalLinkAlt, faSpinner, faEnvelope,
    faCalendarAlt, faComments, faUser, faLink, faUnlink,
    faStar
} from '@fortawesome/free-solid-svg-icons';
import { faInstagram } from '@fortawesome/free-brands-svg-icons';
import Link from 'next/link';
import { toast } from 'sonner';
import VincularContatoModal from '@/components/shared/VincularContatoModal';
import ContactProfile from '@/components/whatsapp/ContactProfile';

// ─── Utilitários ─────────────────────────────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

function formatNumber(n) {
    if (n == null) return null;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
}

function StatCard({ label, value, icon }) {
    return (
        <div className="bg-gray-50 rounded-xl p-3 flex flex-col items-center justify-center text-center border border-gray-100">
            <FontAwesomeIcon icon={icon} className="text-blue-500 text-sm mb-1" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="text-base font-extrabold text-gray-800 mt-0.5">{value ?? '—'}</p>
        </div>
    );
}

// ─── Estado A: Sem Vínculo ────────────────────────────────────────────────────
function SidebarSemVinculo({ conv, profile, organizacaoId, onVincular }) {
    const displayName = profile?.name || conv.participant_name || `Usuário ${String(conv.participant_id).slice(-6)}`;
    const username = profile?.username || conv.participant_username;
    const pic = profile?.profile_pic || conv.participant_profile_pic;
    const [imgError, setImgError] = useState(false);

    // ── Check de sugestão automática (badge) ──
    const { data: matchData } = useQuery({
        queryKey: ['contactMatch', conv?.participant_id, conv?.participant_name, organizacaoId],
        queryFn: async () => {
            const params = new URLSearchParams({
                organizacao_id: organizacaoId,
                name: conv?.participant_name || '',
                username: conv?.participant_username || '',
            });
            const res = await fetch(`/api/instagram/link-contact?${params}`);
            return res.json();
        },
        enabled: !!conv && !!organizacaoId,
        staleTime: 1000 * 60 * 2,
    });

    const sugestoes = matchData?.results || [];
    const melhorSugestao = sugestoes[0];

    return (
        <div className="flex flex-col h-full">
            {/* Foto + nome + username */}
            <div className="p-5 flex flex-col items-center text-center border-b border-gray-100">
                <div className="relative mb-3">
                    {pic && !imgError ? (
                        <img
                            src={pic}
                            alt={displayName}
                            onError={() => setImgError(true)}
                            className="w-20 h-20 rounded-full object-cover border-2 border-gray-100 shadow-sm"
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center text-3xl font-bold text-gray-400">
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-sm"
                        style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
                        <FontAwesomeIcon icon={faInstagram} className="text-white text-[10px]" />
                    </div>
                </div>

                <h3 className="font-bold text-gray-800 text-base leading-tight">{displayName}</h3>

                {username && (
                    <a
                        href={`https://www.instagram.com/${username}/`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-500 hover:text-blue-700 font-semibold mt-0.5 flex items-center gap-1 transition-colors"
                    >
                        @{username}
                        <FontAwesomeIcon icon={faExternalLinkAlt} className="text-[10px]" />
                    </a>
                )}

                {profile?.biography && (
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-3">{profile.biography}</p>
                )}
            </div>

            {/* Stats CRM */}
            <div className="p-4 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Histórico no CRM</p>
                <div className="grid grid-cols-2 gap-2">
                    <StatCard label="Mensagens" value={profile?.total_messages ?? '—'} icon={faComments} />
                    <StatCard
                        label="Último contato"
                        value={profile?.last_message
                            ? new Date(profile.last_message).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                            : '—'}
                        icon={faEnvelope}
                    />
                </div>
                {profile?.first_contact && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-blue-400 shrink-0" />
                        <span>Primeiro contato em <strong className="text-gray-700">{formatDate(profile.first_contact)}</strong></span>
                    </div>
                )}
            </div>

            {/* ── Sugestão de vínculo (match inteligente) ── */}
            <div className="p-4 flex flex-col gap-3">
                {melhorSugestao && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                            <FontAwesomeIcon icon={faStar} className="text-amber-500 text-xs" />
                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                                Vínculo sugerido • {melhorSugestao.confidence}% match
                            </p>
                        </div>
                        <div className="flex items-center gap-2.5 mb-3">
                            {melhorSugestao.foto_url ? (
                                <img src={melhorSugestao.foto_url} alt="" className="w-9 h-9 rounded-full object-cover border border-amber-200" />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm shrink-0">
                                    {(melhorSugestao.nome || '?').charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate">{melhorSugestao.nome || melhorSugestao.razao_social}</p>
                                <p className="text-xs text-gray-400 truncate">{melhorSugestao.telefone || '—'}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => onVincular(melhorSugestao)}
                            className="w-full bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-extrabold shadow-sm hover:bg-amber-600 transition-colors"
                        >
                            Vincular este contato
                        </button>
                    </div>
                )}

                {/* Botão vincular manual */}
                <button
                    onClick={() => onVincular(null)}
                    className="w-full bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                    <FontAwesomeIcon icon={faLink} className="text-blue-400" />
                    {melhorSugestao ? 'Buscar outro contato' : 'Vincular a um contato'}
                </button>
            </div>
        </div>
    );
}

// ─── Estado B: Com Vínculo (usa ContactProfile do WhatsApp) ──────────────────
function SidebarComVinculo({ conv, contatoId, organizacaoId, onDesvincular }) {
    const displayName = conv.participant_name || `Usuário ${String(conv.participant_id).slice(-6)}`;
    const username = conv.participant_username;

    // Monta um objeto "contact" compatível com o ContactProfile do WhatsApp
    const contactForProfile = {
        contato_id: contatoId,
        nome: displayName,
        phone_number: conv.participant_id,
    };

    return (
        <div className="flex flex-col h-full">
            {/* ── Mini-header com info Instagram + links ── */}
            <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
                            <FontAwesomeIcon icon={faInstagram} className="text-white text-[9px]" />
                        </div>
                        {username ? (
                            <a
                                href={`https://www.instagram.com/${username}/`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1"
                            >
                                @{username}
                                <FontAwesomeIcon icon={faExternalLinkAlt} className="text-[9px]" />
                            </a>
                        ) : (
                            <span className="text-xs font-bold text-purple-700">Instagram vinculado</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Botão Ver perfil completo */}
                        <Link
                            href={`/contatos/${contatoId}`}
                            target="_blank"
                            className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-2 py-1 rounded-md hover:bg-blue-50 transition-all"
                        >
                            <FontAwesomeIcon icon={faExternalLinkAlt} className="text-[9px]" />
                            Ver perfil
                        </Link>
                        {/* Desvincular */}
                        <button
                            onClick={onDesvincular}
                            title="Desvincular contato"
                            className="w-6 h-6 inline-flex items-center justify-center rounded-md border border-gray-200 text-gray-300 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
                        >
                            <FontAwesomeIcon icon={faUnlink} className="text-[9px]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── ContactProfile do WhatsApp reutilizado ── */}
            <div className="flex-grow overflow-y-auto custom-scrollbar">
                <ContactProfile contact={contactForProfile} />
            </div>
        </div>
    );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function InstagramProfileSidebar({ conv, organizacaoId, onClose }) {
    const [showModal, setShowModal] = useState(false);
    const [contatoVinculado, setContatoVinculado] = useState(conv?.contato_id || null);
    const queryClient = useQueryClient();

    // Busca dados básicos do perfil Instagram (para o estado sem vínculo)
    const { data: profile, isLoading } = useQuery({
        queryKey: ['instagramProfile', conv?.participant_id, organizacaoId],
        queryFn: async () => {
            const res = await fetch(
                `/api/instagram/profile?participant_id=${conv.participant_id}&organizacao_id=${organizacaoId}`
            );
            if (!res.ok) throw new Error('Erro ao buscar perfil');
            return res.json();
        },
        enabled: !!conv?.participant_id && !!organizacaoId && !contatoVinculado,
        staleTime: 1000 * 60 * 5,
    });

    // Desvincular contato
    const desvincularMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/instagram/link-contact', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instagram_conversation_id: conv.id,
                    contato_id: null,
                    organizacao_id: organizacaoId,
                }),
            });
            if (!res.ok) throw new Error('Erro ao desvincular');
        },
        onSuccess: () => {
            setContatoVinculado(null);
            queryClient.invalidateQueries(['instagramConversations']);
            toast.success('Contato desvinculado.');
        },
        onError: (e) => toast.error('Erro: ' + e.message),
    });

    if (!conv) return null;

    return (
        <div className="w-[300px] shrink-0 flex flex-col h-full bg-white border-l border-gray-200 overflow-hidden">

            {/* ── Header fixo ── */}
            <div className="h-14 border-b flex items-center justify-between px-4 shrink-0 bg-white">
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faUser} className="text-blue-500 text-sm" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {contatoVinculado ? 'Contato CRM' : 'Perfil'}
                    </span>
                    {contatoVinculado && (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-green-50 text-green-700 border border-green-200 uppercase">
                            vinculado
                        </span>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm"
                    title="Fechar"
                >
                    <FontAwesomeIcon icon={faTimes} size="xs" />
                </button>
            </div>

            {/* ── Conteúdo ── */}
            <div className="flex-grow overflow-y-auto custom-scrollbar min-h-0">
                {isLoading && !contatoVinculado ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-blue-400 text-2xl" />
                        <p className="text-xs text-gray-400">Carregando perfil...</p>
                    </div>
                ) : contatoVinculado ? (
                    <SidebarComVinculo
                        conv={conv}
                        contatoId={contatoVinculado}
                        organizacaoId={organizacaoId}
                        onDesvincular={() => {
                            if (confirm('Desvincular este contato do Instagram?')) {
                                desvincularMutation.mutate();
                            }
                        }}
                    />
                ) : (
                    <SidebarSemVinculo
                        conv={conv}
                        profile={profile}
                        organizacaoId={organizacaoId}
                        onVincular={(sugestao) => setShowModal(true)}
                    />
                )}
            </div>

            {/* ── Modal de Vinculação ── */}
            {showModal && (
                <VincularContatoModal
                    conv={conv}
                    organizacaoId={organizacaoId}
                    profilePicUrl={profile?.profile_pic || conv.participant_profile_pic}
                    onClose={() => setShowModal(false)}
                    onVinculado={(contatoId) => setContatoVinculado(contatoId)}
                />
            )}
        </div>
    );
}
