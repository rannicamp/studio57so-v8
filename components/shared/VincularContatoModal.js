'use client'

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTimes, faSearch, faLink, faSpinner, faUser,
    faCheckCircle, faPlus, faStar
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

// ─── Avatares ─────────────────────────────────────────────────────────────────
function AvatarContato({ contato }) {
    const [err, setErr] = useState(false);
    const nome = contato.nome || contato.razao_social || '?';
    if (contato.foto_url && !err) {
        return (
            <img
                src={contato.foto_url}
                alt={nome}
                onError={() => setErr(true)}
                className="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0"
            />
        );
    }
    return (
        <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
            {nome.charAt(0).toUpperCase()}
        </div>
    );
}

function ConfidenceBadge({ confidence }) {
    if (!confidence) return null;
    const color = confidence >= 90
        ? 'bg-green-50 text-green-700 border-green-200'
        : confidence >= 70
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-gray-50 text-gray-500 border-gray-200';
    return (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase ${color}`}>
            {confidence}% match
        </span>
    );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function VincularContatoModal({
    conv,
    organizacaoId,
    profilePicUrl,
    onClose,
    onVinculado,
}) {
    const [search, setSearch] = useState('');
    const [etapa, setEtapa] = useState('sugestao');
    const queryClient = useQueryClient();
    const supabase = createClient();

    // ── Match Inteligente: busca direta no Supabase (client-side, igual ao EmpreendimentoForm) ──
    const { data: sugestoes = [], isLoading: isLoadingMatch } = useQuery({
        queryKey: ['contactMatch', conv?.participant_id, conv?.participant_name, organizacaoId],
        queryFn: async () => {
            const firstName = (conv?.participant_name || '').split(' ')[0];
            if (!firstName || firstName.length < 2) return [];

            const { data, error } = await supabase
                .from('contatos')
                .select('id, nome, razao_social, foto_url, telefone, emails(email), telefones(telefone)')
                .eq('organizacao_id', organizacaoId)
                .or(`nome.ilike.%${firstName}%,razao_social.ilike.%${firstName}%`)
                .order('nome')
                .limit(5);

            if (error) {
                console.error('[VincularModal] Erro match:', error.message);
                return [];
            }

            // Calcula confiança: nome exato = 95%, parcial = 70%
            const nameLower = (conv?.participant_name || '').toLowerCase();
            return (data || []).map(c => {
                const nomeLower = (c.nome || c.razao_social || '').toLowerCase();
                const confidence = nomeLower === nameLower ? 95 : 70;
                return { ...c, confidence };
            }).sort((a, b) => b.confidence - a.confidence);
        },
        enabled: !!conv && !!organizacaoId,
        staleTime: 1000 * 60 * 2,
    });

    // ── Busca manual: mesmo padrão do EmpreendimentoForm.js ──
    const { data: resultadosBusca = [], isLoading: isLoadingSearch } = useQuery({
        queryKey: ['contactSearch', search, organizacaoId],
        queryFn: async () => {
            const term = search.trim();
            if (term.length < 2) return [];

            const { data, error } = await supabase
                .from('contatos')
                .select('id, nome, razao_social, foto_url, telefone, emails(email), telefones(telefone)')
                .eq('organizacao_id', organizacaoId)
                .or(`nome.ilike.%${term}%,razao_social.ilike.%${term}%`)
                .order('nome')
                .limit(10);

            if (error) {
                console.error('[VincularModal] Erro busca:', error.message);
                return [];
            }
            return data || [];
        },
        enabled: search.trim().length >= 2 && etapa === 'busca',
        staleTime: 0,
    });

    // ── Vincular: chama a API que atualiza o banco e propaga a foto ──
    const vincularMutation = useMutation({
        mutationFn: async (contatoId) => {
            const res = await fetch('/api/instagram/link-contact', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instagram_conversation_id: conv.id,
                    contato_id: contatoId,
                    organizacao_id: organizacaoId,
                    profile_pic_url: profilePicUrl,
                }),
            });
            if (!res.ok) throw new Error('Erro ao vincular');
            return res.json();
        },
        onSuccess: (_, contatoId) => {
            toast.success('Contato vinculado! ✨');
            queryClient.invalidateQueries({ queryKey: ['instagramConversations'] });
            onVinculado?.(contatoId);
            onClose();
        },
        onError: (e) => toast.error('Erro: ' + e.message),
    });

    const isLoading = etapa === 'sugestao' ? isLoadingMatch : isLoadingSearch;
    const resultados = etapa === 'sugestao' ? sugestoes : resultadosBusca;
    const temSugestoes = sugestoes.length > 0;

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 py-4 border-b">
                    <div>
                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faLink} className="text-blue-500" />
                            Vincular a um Contato
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Conecta <strong>{conv?.participant_name}</strong> ao CRM
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
                    >
                        <FontAwesomeIcon icon={faTimes} size="xs" />
                    </button>
                </div>

                {/* ── Abas ── */}
                <div className="flex border-b bg-gray-50">
                    <button
                        onClick={() => setEtapa('sugestao')}
                        className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                            etapa === 'sugestao'
                                ? 'border-blue-500 text-blue-600 bg-white'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <FontAwesomeIcon icon={faStar} />
                        Sugestões automáticas
                        {temSugestoes && (
                            <span className="bg-blue-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                {sugestoes.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setEtapa('busca')}
                        className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
                            etapa === 'busca'
                                ? 'border-blue-500 text-blue-600 bg-white'
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <FontAwesomeIcon icon={faSearch} />
                        Buscar manualmente
                    </button>
                </div>

                {/* ── Campo de busca (aba manual) ── */}
                {etapa === 'busca' && (
                    <div className="px-4 pt-4">
                        <div className="relative">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Digite o nome do contato..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm placeholder-gray-400"
                            />
                        </div>
                    </div>
                )}

                {/* ── Resultados ── */}
                <div className="p-4 max-h-72 overflow-y-auto custom-scrollbar space-y-2">
                    {isLoading && (
                        <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                            <FontAwesomeIcon icon={faSpinner} spin />
                            <span className="text-sm">Buscando contatos...</span>
                        </div>
                    )}

                    {!isLoading && etapa === 'sugestao' && !temSugestoes && (
                        <div className="text-center py-6">
                            <FontAwesomeIcon icon={faUser} className="text-gray-200 text-3xl mb-2" />
                            <p className="text-sm text-gray-400">Nenhuma sugestão encontrada pelo nome.</p>
                            <button
                                onClick={() => setEtapa('busca')}
                                className="mt-3 text-xs text-blue-500 hover:underline font-bold"
                            >
                                Buscar manualmente →
                            </button>
                        </div>
                    )}

                    {!isLoading && etapa === 'busca' && search.trim().length < 2 && (
                        <p className="text-xs text-gray-400 text-center py-6">
                            Digite pelo menos 2 caracteres para buscar
                        </p>
                    )}

                    {!isLoading && resultados.map(contato => (
                        <div
                            key={contato.id}
                            className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
                        >
                            <AvatarContato contato={contato} />
                            <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-bold text-gray-800 truncate">
                                        {contato.nome || contato.razao_social}
                                    </p>
                                    <ConfidenceBadge confidence={contato.confidence} />
                                </div>
                                <p className="text-xs text-gray-400 truncate">
                                    {contato.telefone
                                        || contato.telefones?.[0]?.telefone
                                        || contato.emails?.[0]?.email
                                        || 'Sem contato cadastrado'}
                                </p>
                            </div>
                            <button
                                onClick={() => vincularMutation.mutate(contato.id)}
                                disabled={vincularMutation.isPending}
                                className="shrink-0 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-extrabold shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {vincularMutation.isPending
                                    ? <FontAwesomeIcon icon={faSpinner} spin />
                                    : <FontAwesomeIcon icon={faCheckCircle} />}
                                Vincular
                            </button>
                        </div>
                    ))}
                </div>

                {/* ── Footer ── */}
                <div className="px-4 pb-4 border-t pt-3 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="text-sm text-gray-400 hover:text-gray-600 font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => toast.info('Crie o contato na página de Contatos e volte para vincular!')}
                        className="flex items-center gap-1.5 text-xs font-bold text-blue-500 hover:text-blue-700 transition-colors"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        Criar novo contato
                    </button>
                </div>
            </div>
        </div>
    );
}
