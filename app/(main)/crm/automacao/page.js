// app/(main)/crm/automacao/page.js
"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlus, faTrash, faToggleOn, faToggleOff,
    faRobot, faSpinner, faChevronDown, faArrowRight,
    faBullhorn, faAd, faGlobe
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import Link from 'next/link';
import { useEffect } from 'react';

const supabase = createClient();

// ─── helpers ────────────────────────────────────────────────────────────────

const fetchDadosRoteamento = async (organizacaoId) => {
    if (!organizacaoId) return { regras: [], funis: [], campaigns: [], ads: [] };

    const [
        { data: regras },
        { data: funis },
        { data: contatos },
    ] = await Promise.all([
        supabase.from('regras_roteamento_funil')
            .select('*')
            .eq('organizacao_id', organizacaoId)
            .order('ordem', { ascending: true }),
        supabase.from('funis')
            .select('id, nome, is_sistema')
            .eq('organizacao_id', organizacaoId)
            .order('is_sistema', { ascending: false }),
        supabase.from('contatos')
            .select('meta_campaign_id, meta_campaign_name, meta_ad_id, meta_ad_name')
            .eq('organizacao_id', organizacaoId)
            .not('meta_campaign_id', 'is', null),
    ]);

    const campaigns = [...new Map(
        (contatos || [])
            .filter(c => c.meta_campaign_id && c.meta_campaign_name)
            .map(c => [c.meta_campaign_id, { id: c.meta_campaign_id, nome: c.meta_campaign_name }])
    ).values()].sort((a, b) => a.nome.localeCompare(b.nome));

    const ads = [...new Map(
        (contatos || [])
            .filter(c => c.meta_ad_id && c.meta_ad_name)
            .map(c => [c.meta_ad_id, { id: c.meta_ad_id, nome: c.meta_ad_name }])
    ).values()].sort((a, b) => a.nome.localeCompare(b.nome));

    return { regras: regras || [], funis: funis || [], campaigns, ads };
};

// ─── componente de formulário de nova regra ──────────────────────────────────

function NovaRegraForm({ funis, campaigns, ads, organizacaoId, onSaved, onCancel }) {
    const [form, setForm] = useState({
        nome: '',
        campaign_id: '',
        ad_id: '',
        funil_destino_id: '',
    });

    const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

    const queryClient = useQueryClient();
    const funisDestino = funis.filter(f => !f.is_sistema);

    const criarMutation = useMutation({
        mutationFn: async () => {
            const funilId = (form.funil_destino_id || '').trim();
            if (!funilId) throw new Error('Escolha o funil de destino.');
            if (!form.campaign_id && !form.ad_id) throw new Error('Defina pelo menos uma condição (campanha ou anúncio).');
            const { error } = await supabase.from('regras_roteamento_funil').insert({
                organizacao_id: organizacaoId,
                nome: form.nome || 'Regra de roteamento',
                campaign_id: form.campaign_id || null,
                ad_id: form.ad_id || null,
                funil_destino_id: funilId,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Regra criada!');
            queryClient.invalidateQueries({ queryKey: ['roteamento', organizacaoId] });
            onSaved();
        },
        onError: e => toast.error(e.message),
    });

    const funilDestino = funis.find(f => String(f.id) === form.funil_destino_id);

    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faRobot} className="text-blue-500" />
                Nova Regra de Roteamento
            </h3>

            {/* Nome */}
            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da regra (opcional)</label>
                <input
                    type="text"
                    placeholder="Ex: Leads do Residencial Alfa"
                    value={form.nome}
                    onChange={e => set('nome', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
            </div>

            {/* Condições */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                        <FontAwesomeIcon icon={faBullhorn} className="text-blue-400" /> Campanha (SE)
                    </label>
                    <select
                        value={form.campaign_id}
                        onChange={e => set('campaign_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                        <option value="">Qualquer campanha</option>
                        {campaigns.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                        <FontAwesomeIcon icon={faAd} className="text-purple-400" /> Anúncio (SE)
                    </label>
                    <select
                        value={form.ad_id}
                        onChange={e => set('ad_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                        <option value="">Qualquer anúncio</option>
                        {ads.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                </div>
            </div>

            {/* Destino */}
            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                    <FontAwesomeIcon icon={faArrowRight} className="text-green-500" /> Mover para o funil (ENTAO)
                </label>
                {funisDestino.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-700">
                        Voce nao tem funis customizados ainda. Crie um novo funil no CRM primeiro.
                    </div>
                ) : (
                    <select
                        value={form.funil_destino_id}
                        onChange={e => set('funil_destino_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                        <option value="">-- Escolha o funil destino --</option>
                        {funisDestino.map(f => (
                            <option key={f.id} value={String(f.id)}>{f.nome}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Preview */}
            {(form.campaign_id || form.ad_id) && form.funil_destino_id && (
                <div className="bg-white border border-blue-100 rounded-lg p-3 text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-blue-700">SE</span>
                    {form.campaign_id && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">campanha: {campaigns.find(c => c.id === form.campaign_id)?.nome}</span>}
                    {form.ad_id && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs">anúncio: {ads.find(a => a.id === form.ad_id)?.nome}</span>}
                    <span className="font-semibold text-green-700">ENTÃO</span>
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">funil: {funilDestino?.nome}</span>
                </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                    Cancelar
                </button>
                <button
                    onClick={() => criarMutation.mutate()}
                    disabled={criarMutation.isPending}
                    className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors flex items-center gap-2"
                >
                    {criarMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} />}
                    Criar Regra
                </button>
            </div>
        </div>
    );
}

// ─── card de regra existente ─────────────────────────────────────────────────

function RegraCard({ regra, funis, campaigns, ads, organizacaoId }) {
    const queryClient = useQueryClient();

    const toggleMutation = useMutation({
        mutationFn: async () => {
            await supabase.from('regras_roteamento_funil')
                .update({ ativo: !regra.ativo })
                .eq('id', regra.id);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roteamento', organizacaoId] }),
        onError: e => toast.error(e.message),
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            await supabase.from('regras_roteamento_funil').delete().eq('id', regra.id);
        },
        onSuccess: () => {
            toast.success('Regra removida.');
            queryClient.invalidateQueries({ queryKey: ['roteamento', organizacaoId] });
        },
        onError: e => toast.error(e.message),
    });

    const funilDestino = funis.find(f => f.id === regra.funil_destino_id);
    const campaign = campaigns.find(c => c.id === regra.campaign_id);
    const ad = ads.find(a => a.id === regra.ad_id);

    return (
        <div className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-all ${regra.ativo ? 'border-gray-200 shadow-sm' : 'border-dashed border-gray-200 opacity-60'}`}>
            {/* Ícone + toggle */}
            <div className="flex flex-col items-center gap-2 pt-1">
                <FontAwesomeIcon icon={faRobot} className={`text-xl ${regra.ativo ? 'text-blue-500' : 'text-gray-300'}`} />
                <button
                    onClick={() => toggleMutation.mutate()}
                    disabled={toggleMutation.isPending}
                    title={regra.ativo ? 'Desativar' : 'Ativar'}
                >
                    <FontAwesomeIcon
                        icon={regra.ativo ? faToggleOn : faToggleOff}
                        className={`text-2xl ${regra.ativo ? 'text-green-500' : 'text-gray-300'}`}
                    />
                </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{regra.nome}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs font-bold text-blue-600">SE</span>
                    {campaign
                        ? <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full text-xs flex items-center gap-1"><FontAwesomeIcon icon={faBullhorn} className="text-xs" />{campaign.nome}</span>
                        : <span className="text-xs text-gray-400 italic">qualquer campanha</span>
                    }
                    {ad && <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full text-xs flex items-center gap-1"><FontAwesomeIcon icon={faAd} className="text-xs" />{ad.nome}</span>}
                    <span className="text-xs font-bold text-green-600">ENTÃO</span>
                    <span className="bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                        <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                        {funilDestino?.nome || `Funil #${regra.funil_destino_id}`}
                    </span>
                </div>
            </div>

            {/* Excluir */}
            <button
                onClick={() => { if (confirm('Remover esta regra?')) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
                className="text-gray-300 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                title="Excluir regra"
            >
                {deleteMutation.isPending
                    ? <FontAwesomeIcon icon={faSpinner} spin />
                    : <FontAwesomeIcon icon={faTrash} />
                }
            </button>
        </div>
    );
}

// ─── página principal ────────────────────────────────────────────────────────

export default function AutomacaoPage() {
    const { setPageTitle } = useLayout();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    useEffect(() => { if (setPageTitle) setPageTitle('CRM - Automação'); }, [setPageTitle]);

    const [showForm, setShowForm] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['roteamento', organizacaoId],
        queryFn: () => fetchDadosRoteamento(organizacaoId),
        enabled: !!organizacaoId,
        staleTime: 1000 * 60 * 2,
    });

    const { regras = [], funis = [], campaigns = [], ads = [] } = data || {};

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <FontAwesomeIcon icon={faRobot} className="text-blue-500" />
                        Automação · Roteamento de Leads
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Define regras para mover leads automaticamente do <strong>Funil de Entrada</strong> para funis específicos.
                    </p>
                </div>
                <Link href="/crm" className="text-sm text-blue-600 hover:underline">← Voltar ao CRM</Link>
            </div>

            {/* Como funciona */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800 space-y-1">
                <p className="font-semibold">Como funciona:</p>
                <p>1. Todo lead que chega do Meta cai no <strong>Funil de Entrada</strong> (coluna ENTRADA).</p>
                <p>2. O sistema verifica as regras abaixo <strong>na ordem de prioridade</strong> (mais específicas primeiro).</p>
                <p>3. Se uma regra bater, o lead é <strong>movido automaticamente</strong> para o funil destino.</p>
                <p>4. Se nenhuma regra bater, o lead permanece no Funil de Entrada.</p>
            </div>

            {/* Botão nova regra */}
            {!showForm && (
                <button
                    onClick={() => setShowForm(true)}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50 rounded-xl py-3 text-sm font-semibold transition-all"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Nova Regra de Roteamento
                </button>
            )}

            {showForm && (
                <NovaRegraForm
                    funis={funis}
                    campaigns={campaigns}
                    ads={ads}
                    organizacaoId={organizacaoId}
                    onSaved={() => setShowForm(false)}
                    onCancel={() => setShowForm(false)}
                />
            )}

            {/* Lista de regras */}
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-blue-400 text-2xl" />
                </div>
            ) : regras.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <FontAwesomeIcon icon={faRobot} className="text-5xl mb-3 opacity-20" />
                    <p className="font-medium">Nenhuma regra criada ainda.</p>
                    <p className="text-sm">Crie a primeira regra para que os leads sejam direcionados automaticamente.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{regras.length} regra(s) — executadas em ordem de especificidade</p>
                    {regras.map(regra => (
                        <RegraCard
                            key={regra.id}
                            regra={regra}
                            funis={funis}
                            campaigns={campaigns}
                            ads={ads}
                            organizacaoId={organizacaoId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
