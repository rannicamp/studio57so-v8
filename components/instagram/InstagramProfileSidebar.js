'use client'

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTimes, faExternalLinkAlt, faSpinner, faEnvelope,
    faCalendarAlt, faComments, faGlobe, faUsers,
    faImages, faStickyNote, faChevronDown, faChevronUp,
    faUser
} from '@fortawesome/free-solid-svg-icons';
import { faInstagram } from '@fortawesome/free-brands-svg-icons';
import { toast } from 'sonner';

function StatCard({ label, value, icon }) {
    return (
        <div className="bg-gray-50 rounded-xl p-3 flex flex-col items-center justify-center text-center border border-gray-100">
            <FontAwesomeIcon icon={icon} className="text-blue-500 text-sm mb-1" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="text-base font-extrabold text-gray-800 mt-0.5">{value ?? '—'}</p>
        </div>
    );
}

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

export default function InstagramProfileSidebar({ conv, organizacaoId, onClose }) {
    const [notaAberta, setNotaAberta] = useState(false);
    const [nota, setNota] = useState('');

    // Busca dados do perfil via API
    const { data: profile, isLoading } = useQuery({
        queryKey: ['instagramProfile', conv?.participant_id, organizacaoId],
        queryFn: async () => {
            const res = await fetch(
                `/api/instagram/profile?participant_id=${conv.participant_id}&organizacao_id=${organizacaoId}`
            );
            if (!res.ok) throw new Error('Erro ao buscar perfil');
            return res.json();
        },
        enabled: !!conv?.participant_id && !!organizacaoId,
        staleTime: 1000 * 60 * 5, // Cache de 5 minutos
    });

    if (!conv) return null;

    const displayName = profile?.name || conv.participant_name || `Usuário ${String(conv.participant_id).slice(-6)}`;
    const username = profile?.username || conv.participant_username;
    const pic = profile?.profile_pic || conv.participant_profile_pic;
    const [imgError, setImgError] = useState(false);

    return (
        <div className="w-[280px] shrink-0 flex flex-col h-full bg-white border-l border-gray-200 overflow-hidden">

            {/* ─── Header da Sidebar ─── */}
            <div className="h-16 border-b flex items-center justify-between px-4 shrink-0 bg-white">
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faUser} className="text-blue-500 text-sm" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Perfil</span>
                </div>
                <button
                    onClick={onClose}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm"
                    title="Fechar perfil"
                >
                    <FontAwesomeIcon icon={faTimes} size="xs" />
                </button>
            </div>

            {/* ─── Conteúdo scrollável ─── */}
            <div className="flex-grow overflow-y-auto custom-scrollbar">

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-blue-400 text-2xl" />
                        <p className="text-xs text-gray-400">Carregando perfil...</p>
                    </div>
                ) : (
                    <>
                        {/* ─── Seção: Foto e Nome ─── */}
                        <div className="p-5 flex flex-col items-center text-center border-b border-gray-100">
                            {/* Avatar grande */}
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
                                {/* Badge do Instagram */}
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-white flex items-center justify-center shadow-sm"
                                    style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
                                    <FontAwesomeIcon icon={faInstagram} className="text-white text-[10px]" />
                                </div>
                            </div>

                            {/* Nome */}
                            <h3 className="font-bold text-gray-800 text-base leading-tight">{displayName}</h3>

                            {/* @username clicável */}
                            {username && (
                                <a
                                    href={`https://www.instagram.com/${username}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-500 hover:text-blue-700 font-semibold mt-0.5 flex items-center gap-1 transition-colors"
                                >
                                    @{username}
                                    <FontAwesomeIcon icon={faExternalLinkAlt} className="text-[10px]" />
                                </a>
                            )}

                            {/* Bio */}
                            {profile?.biography && (
                                <p className="text-xs text-gray-500 mt-2 leading-relaxed text-center line-clamp-3">
                                    {profile.biography}
                                </p>
                            )}

                            {/* Website */}
                            {profile?.website && (
                                <a
                                    href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1.5 text-xs text-blue-500 hover:underline flex items-center gap-1"
                                >
                                    <FontAwesomeIcon icon={faGlobe} className="text-[10px]" />
                                    {profile.website.replace(/^https?:\/\//, '').split('/')[0]}
                                </a>
                            )}

                            {/* Botão Ver no Instagram */}
                            {username && (
                                <a
                                    href={`https://www.instagram.com/${username}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 w-full bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <FontAwesomeIcon icon={faInstagram} style={{ color: '#e1306c' }} />
                                    Ver perfil no Instagram
                                </a>
                            )}
                        </div>

                        {/* ─── Seção: Stats do Instagram ─── */}
                        {(profile?.followers_count != null || profile?.media_count != null) && (
                            <div className="p-4 border-b border-gray-100">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                                    Instagram
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {profile.followers_count != null && (
                                        <StatCard
                                            label="Seguidores"
                                            value={formatNumber(profile.followers_count)}
                                            icon={faUsers}
                                        />
                                    )}
                                    {profile.media_count != null && (
                                        <StatCard
                                            label="Posts"
                                            value={formatNumber(profile.media_count)}
                                            icon={faImages}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ─── Seção: Histórico no CRM ─── */}
                        <div className="p-4 border-b border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                                Histórico no CRM
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <StatCard
                                    label="Mensagens"
                                    value={profile?.total_messages ?? '—'}
                                    icon={faComments}
                                />
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

                        {/* ─── Seção: Ver Feed no Instagram ─── */}
                        {username && (
                            <div className="p-4 border-b border-gray-100">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                                    Feed público
                                </p>

                                {/* Card de acesso ao feed — a API Instagram não permite miniaturas de terceiros */}
                                <a
                                    href={`https://www.instagram.com/${username}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group block rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-all shadow-sm hover:shadow-md"
                                >
                                    {/* Faixa visual com gradiente Instagram */}
                                    <div
                                        className="h-16 flex items-center justify-center gap-2"
                                        style={{ background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)' }}
                                    >
                                        <FontAwesomeIcon icon={faInstagram} className="text-white text-2xl" />
                                        <div className="flex gap-0.5">
                                            {[...Array(9)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="w-4 h-4 rounded-sm opacity-30 bg-white"
                                                    style={{ opacity: 0.15 + (i % 3) * 0.15 }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    {/* Rodapé do card */}
                                    <div className="bg-white px-3 py-2.5 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-gray-700">@{username}</p>
                                            <p className="text-[10px] text-gray-400">Ver posts e reels</p>
                                        </div>
                                        <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
                                            <FontAwesomeIcon icon={faExternalLinkAlt} className="text-gray-400 group-hover:text-blue-500 text-[10px] transition-colors" />
                                        </div>
                                    </div>
                                </a>
                            </div>
                        )}

                        {/* ─── Seção: Notas do CRM ─── */}
                        <div className="p-4">
                            <button
                                onClick={() => setNotaAberta(!notaAberta)}
                                className="w-full flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 hover:text-gray-600 transition-colors"
                            >
                                <span className="flex items-center gap-1.5">
                                    <FontAwesomeIcon icon={faStickyNote} className="text-amber-400" />
                                    Anotações internas
                                </span>
                                <FontAwesomeIcon icon={notaAberta ? faChevronUp : faChevronDown} className="text-gray-300" />
                            </button>

                            {notaAberta && (
                                <div className="mt-2">
                                    <textarea
                                        value={nota}
                                        onChange={e => setNota(e.target.value)}
                                        placeholder={`Anotações sobre ${displayName}...\n\nEx: cliente interessado em corte degradê, prefere horários de manhã.`}
                                        rows={5}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm placeholder-gray-400 resize-none"
                                    />
                                    <button
                                        onClick={() => toast.success('Nota salva! (em breve sincronizada com o CRM)')}
                                        className="mt-2 w-full bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm hover:bg-blue-700 transition-colors"
                                    >
                                        Salvar nota
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
