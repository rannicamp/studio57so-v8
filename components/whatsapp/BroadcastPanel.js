'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faBullhorn, faUsers, faPaperPlane, faSpinner, faArrowLeft, 
    faClock, faCheckCircle, faTimesCircle, faCalendarAlt, 
    faEdit, faTrash, faPlay, faSync, faBolt, faLock, faEye, faCheckDouble,
    faPause, faStop, faTachometerAlt, faFilter 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TemplateMessageModal from './TemplateMessageModal';
import CreateBroadcastModal from './CreateBroadcastModal';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Componente da Barra de Progresso
const ProgressBar = ({ stats, total }) => {
    if (!total || total === 0) return null;
    
    const sentCount = stats.success_count ?? stats.sent ?? 0;
    const failedCount = stats.failed_count ?? stats.failed ?? 0;
    const readCount = stats.read ?? 0;
    const deliveredCount = stats.delivered ?? 0;

    const sentPct = Math.round((sentCount / total) * 100);
    const failedPct = Math.round((failedCount / total) * 100);
    const readPct = Math.round((readCount / total) * 100); 
    const deliveredPct = Math.round((deliveredCount / total) * 100);

    return (
        <div className="w-full mt-3">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase font-bold tracking-wide">
                <span>Envio: {sentPct}%</span>
                <span>{readPct}% Lido</span>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden flex">
                <div style={{ width: `${readPct}%` }} className="h-full bg-green-600 transition-all duration-500" title="Lido" />
                <div style={{ width: `${Math.max(0, deliveredPct - readPct)}%` }} className="h-full bg-green-400 transition-all duration-500" title="Entregue" />
                <div style={{ width: `${Math.max(0, sentPct - deliveredPct)}%` }} className="h-full bg-blue-300 transition-all duration-500" title="Enviado" />
                <div style={{ width: `${failedPct}%` }} className="h-full bg-red-400 transition-all duration-500" title="Falha" />
            </div>
            <div className="flex gap-3 mt-1 text-[10px] text-gray-600 justify-between">
                <div className="flex gap-3">
                    <span className="flex items-center gap-1" title="Lidos"><FontAwesomeIcon icon={faCheckDouble} className="text-green-600" /> {readCount}</span>
                    <span className="flex items-center gap-1" title="Entregues"><FontAwesomeIcon icon={faCheckDouble} className="text-green-400" /> {deliveredCount}</span>
                    <span className="flex items-center gap-1" title="Erros"><FontAwesomeIcon icon={faTimesCircle} className="text-red-400" /> {failedCount}</span>
                </div>
                <span className="font-bold text-gray-400">{sentCount + failedCount}/{total} Proc.</span>
            </div>
        </div>
    );
};

export default function BroadcastPanel({ list, onBack }) {
    const [members, setMembers] = useState([]);
    const [broadcasts, setBroadcasts] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isEditListOpen, setIsEditListOpen] = useState(false);
    const [editingBroadcast, setEditingBroadcast] = useState(null);
    const [sending, setSending] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);

    const supabase = createClient();
    const queryClient = useQueryClient();

    // Mutação de Controle
    const controlMutation = useMutation({
        mutationFn: async ({ id, action, organizacao_id }) => {
            const response = await fetch('/api/whatsapp/scheduled-broadcasts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action, organizacao_id })
            });
            if (!response.ok) throw new Error('Erro ao controlar transmissão');
            return action;
        },
        onSuccess: (action) => {
            const msg = action === 'pause' ? 'Pausado!' : action === 'resume' ? 'Retomado!' : 'Parado!';
            toast.success(msg);
            fetchData();
        },
        onError: () => toast.error("Erro ao enviar comando.")
    });

    const fetchData = useCallback(async () => {
        if (!list?.id) return;
        setLoading(true);
        
        try {
            // --- CORREÇÃO APLICADA AQUI ---
            // Usamos a referência explícita da chave estrangeira (!contatos_no_funil_contato_id_fkey)
            // igualzinho ao que você me mostrou no código do modal que funciona.
            const { data: membersData, error: membersError } = await supabase
                .from('whatsapp_list_members')
                .select(`
                    contatos (
                        id, 
                        nome, 
                        telefones(telefone), 
                        tipo_contato,
                        contatos_no_funil!contatos_no_funil_contato_id_fkey (
                            colunas_funil (
                                nome
                            )
                        )
                    )
                `)
                .eq('lista_id', list.id);

            if (membersError) {
                console.error("Erro ao buscar membros:", membersError);
                toast.error("Erro ao carregar lista de membros.");
            }
                
            if (membersData) {
                const formatted = membersData.map(m => {
                    const c = m.contatos;
                    if (!c) return null;

                    // Lógica robusta copiada do seu exemplo para pegar a etapa
                    const funilInfo = Array.isArray(c.contatos_no_funil) ? c.contatos_no_funil[0] : c.contatos_no_funil;
                    const etapaNome = funilInfo?.colunas_funil?.nome || null;

                    return {
                        id: c.id, 
                        nome: c.nome, 
                        telefone: c.telefones?.[0]?.telefone, 
                        tipo: c.tipo_contato,
                        etapa: etapaNome // Etapa do funil extraída corretamente
                    };
                }).filter(c => c && c.telefone);
                
                setMembers(formatted);
            }

            // Histórico com Estatísticas
            const { data: broadcastsData } = await supabase
                .from('whatsapp_scheduled_broadcasts')
                .select('*')
                .eq('lista_id', list.id)
                .order('scheduled_at', { ascending: false });
                
            if (broadcastsData) {
                const broadcastsWithStats = await Promise.all(broadcastsData.map(async (b) => {
                    let rpcStats = { read: 0, delivered: 0 };
                    try {
                        const { data: s } = await supabase.rpc('get_broadcast_stats', { p_broadcast_id: b.id });
                        if (s) rpcStats = s;
                    } catch (e) { }

                    return { 
                        ...b, 
                        stats: { 
                            ...rpcStats,
                            sent: b.success_count || 0,
                            failed: b.failed_count || 0,
                            total: b.total_contacts || 0
                        } 
                    };
                }));
                setBroadcasts(broadcastsWithStats);
            }
        } catch (error) {
            console.error("Erro geral fetchData:", error);
        } finally {
            setLoading(false);
        }
    }, [list, supabase]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Realtime
    useEffect(() => {
        if (!list?.id) return;
        const channelMsg = supabase.channel(`msgs-stats-${list.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' }, () => fetchData())
            .subscribe();
            
        const channelBroadcast = supabase.channel(`broadcasts-${list.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_scheduled_broadcasts', filter: `lista_id=eq.${list.id}` }, () => fetchData())
            .subscribe();

        return () => { 
            supabase.removeChannel(channelMsg);
            supabase.removeChannel(channelBroadcast);
        };
    }, [list, supabase, fetchData]);

    // Funções de ação
    const handleListUpdated = () => { fetchData(); toast.success("Lista atualizada!"); };
    const handleSyncList = async () => { setSyncing(true); try { await fetch('/api/whatsapp/lists/sync', { method: 'POST', body: JSON.stringify({ list_id: list.id }) }); toast.success("Atualizada!"); fetchData(); } catch(e){ toast.error(e.message); } finally { setSyncing(false); } };
    const handleSendBroadcast = async (t, l, v, f, c, s, eid) => { setSending(true); try { const url = eid ? '/api/whatsapp/scheduled-broadcasts' : '/api/whatsapp/broadcast/send'; const method = eid ? 'PUT' : 'POST'; await fetch(url, { method, body: JSON.stringify({ id: eid, list_id: list.id, template_name: t, language: l, variables: v, full_text_base: f, components: c, scheduled_at: s }) }); toast.success("Salvo!"); setIsTemplateModalOpen(false); setEditingBroadcast(null); fetchData(); } catch(e){ toast.error(e.message); } finally { setSending(false); } };
    const handleDeleteBroadcast = async (id) => { if(!confirm("Excluir agendamento?")) return; await fetch(`/api/whatsapp/scheduled-broadcasts?id=${id}`, { method: 'DELETE' }); fetchData(); };
    const handleProcessQueue = async () => { setIsProcessingQueue(true); await fetch('/api/cron/process-broadcasts'); fetchData(); setIsProcessingQueue(false); };
    const handleEditBroadcast = (b) => { setEditingBroadcast(b); setIsTemplateModalOpen(true); };
    const handleOpenNew = () => { setEditingBroadcast(null); setIsTemplateModalOpen(true); };
    
    const handleControl = (id, action, orgId) => {
        if (action === 'stop' && !confirm("Tem certeza que deseja cancelar definitivamente?")) return;
        controlMutation.mutate({ id, action, organizacao_id: orgId });
    };

    const getSpeed = (broadcast) => {
        if (!broadcast.started_at) return 0;
        const minutes = Math.max(1, differenceInMinutes(new Date(), new Date(broadcast.started_at)));
        return Math.round((broadcast.processed_count || 0) / minutes);
    };

    const getStatusInfo = (b) => {
        if (b.status === 'completed') return { icon: faCheckCircle, color: 'text-green-500', label: 'Concluído', bg: 'bg-white border-green-200' };
        if (b.status === 'failed') return { icon: faTimesCircle, color: 'text-red-500', label: 'Falhou', bg: 'bg-red-50 border-red-100' };
        if (b.status === 'processing') return { icon: faSpinner, color: 'text-blue-500', label: 'Enviando...', bg: 'bg-blue-50 border-blue-200', spin: true };
        if (b.status === 'paused') return { icon: faPause, color: 'text-orange-500', label: 'Pausado', bg: 'bg-orange-50 border-orange-200' };
        if (b.status === 'stopped') return { icon: faStop, color: 'text-red-600', label: 'Cancelado', bg: 'bg-gray-100 border-gray-200' };
        const isFuture = new Date(b.scheduled_at) > new Date();
        return { icon: faClock, color: isFuture ? 'text-yellow-600' : 'text-orange-500', label: isFuture ? 'Agendado' : 'Na Fila', bg: 'bg-yellow-50 border-yellow-100' };
    };

    const hasPendingQueue = broadcasts.some(b => b.status === 'pending' && new Date(b.scheduled_at) <= new Date());

    if (!list) return null;

    return (
        <div className="flex flex-col h-full bg-[#efeae2] relative">
            <TemplateMessageModal isOpen={isTemplateModalOpen} onClose={() => { setIsTemplateModalOpen(false); setEditingBroadcast(null); }} onSendTemplate={handleSendBroadcast} contactName="{{1}}" showScheduling={true} initialData={editingBroadcast} />
            <CreateBroadcastModal isOpen={isEditListOpen} onClose={() => setIsEditListOpen(false)} onListCreated={handleListUpdated} initialData={list} />

            <div className="bg-[#f0f2f5] px-4 py-2 border-b border-gray-300 flex items-center gap-3 shadow-sm h-16 justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                    {onBack && <button onClick={onBack} className="md:hidden text-[#54656f] p-2 -ml-2 rounded-full hover:bg-black/5"><FontAwesomeIcon icon={faArrowLeft} /></button>}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${list.is_dynamic ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-500'}`}><FontAwesomeIcon icon={list.is_dynamic ? faBolt : faLock} /></div>
                    <div className="flex-grow min-w-0">
                        <h3 className="font-medium text-[#111b21] truncate flex items-center gap-2">{list.nome} <button onClick={() => setIsEditListOpen(true)} className="text-gray-400 hover:text-[#00a884] text-xs"><FontAwesomeIcon icon={faEdit} /></button></h3>
                        <p className="text-xs text-[#667781]">{list.is_dynamic ? 'Dinâmica' : 'Manual'} • {members.length} membros</p>
                    </div>
                </div>
                {list.is_dynamic && <button onClick={handleSyncList} disabled={syncing} className="text-[#00a884] hover:bg-[#00a884]/10 p-2 rounded-full transition-colors flex-shrink-0 mr-4"><FontAwesomeIcon icon={faSync} spin={syncing} /></button>}
            </div>

            <div className="flex-grow p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                {/* AÇÃO PRINCIPAL */}
                <div className="bg-white p-6 rounded-lg shadow-sm text-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Nova Transmissão</h2>
                    <p className="text-gray-600 mb-6 text-sm">Disparar mensagem para {members.length} contatos.</p>
                    {sending ? <div className="text-[#00a884]"><FontAwesomeIcon icon={faSpinner} spin size="2x" /><p>Processando...</p></div> : 
                    <button onClick={handleOpenNew} disabled={members.length === 0} className="bg-[#00a884] text-white px-6 py-3 rounded-lg hover:bg-[#008f6f] flex items-center justify-center gap-2 mx-auto disabled:opacity-50"><FontAwesomeIcon icon={faPaperPlane} /> Criar Mensagem</button>}
                </div>

                {/* HISTÓRICO */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2"><FontAwesomeIcon icon={faCalendarAlt} /> Histórico</h4>
                        {hasPendingQueue && <button onClick={handleProcessQueue} disabled={isProcessingQueue} className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-200 font-bold flex items-center gap-2 animate-pulse">{isProcessingQueue ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlay} />} Forçar Robô</button>}
                    </div>
                    
                    {broadcasts.length === 0 ? <p className="text-sm text-gray-400 italic ml-1">Nenhum histórico.</p> : (
                        <div className="space-y-3">
                            {broadcasts.map(broadcast => {
                                const statusInfo = getStatusInfo(broadcast);
                                const isPending = broadcast.status === 'pending';
                                const isProcessing = broadcast.status === 'processing';
                                const isPaused = broadcast.status === 'paused';
                                const speed = getSpeed(broadcast);
                                const totalReal = broadcast.total_contacts || members.length;

                                return (
                                    <div key={broadcast.id} className={`p-4 rounded-lg border shadow-sm ${statusInfo.bg}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center ${statusInfo.color} border shadow-sm`}><FontAwesomeIcon icon={statusInfo.icon} spin={statusInfo.spin} /></div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">{broadcast.template_name.replace(/_/g, ' ')}</p>
                                                    <p className="text-xs text-gray-500">{format(new Date(broadcast.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isPending && (
                                                    <>
                                                        <button onClick={() => handleEditBroadcast(broadcast)} className="text-blue-500 hover:bg-blue-50 p-2 rounded"><FontAwesomeIcon icon={faEdit} /></button>
                                                        <button onClick={() => handleDeleteBroadcast(broadcast.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><FontAwesomeIcon icon={faTrash} /></button>
                                                    </>
                                                )}
                                                <div className={`text-xs font-bold px-2 py-1 rounded ${statusInfo.color} bg-white border`}>{statusInfo.label}</div>
                                            </div>
                                        </div>
                                        
                                        {(isProcessing || isPaused) && (
                                            <div className="mt-3 pt-3 border-t border-gray-200/50 flex justify-between items-center bg-white/50 p-2 rounded">
                                                <div className="text-xs font-mono text-gray-600 flex items-center gap-2">
                                                    <FontAwesomeIcon icon={faTachometerAlt} className="text-blue-500"/>
                                                    {speed > 0 ? `${speed} envios/min` : 'Calculando...'}
                                                </div>
                                                <div className="flex gap-2">
                                                    {isProcessing && (
                                                        <button onClick={() => handleControl(broadcast.id, 'pause', broadcast.organizacao_id)} className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded hover:bg-yellow-200 font-semibold flex gap-1 items-center">
                                                            <FontAwesomeIcon icon={faPause} /> Pausar
                                                        </button>
                                                    )}
                                                    {isPaused && (
                                                        <button onClick={() => handleControl(broadcast.id, 'resume', broadcast.organizacao_id)} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 font-semibold flex gap-1 items-center">
                                                            <FontAwesomeIcon icon={faPlay} /> Retomar
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleControl(broadcast.id, 'stop', broadcast.organizacao_id)} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 font-semibold flex gap-1 items-center">
                                                        <FontAwesomeIcon icon={faStop} /> Parar
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {broadcast.stats && broadcast.status !== 'pending' && (
                                            <ProgressBar stats={broadcast.stats} total={totalReal} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* MEMBROS */}
                <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faUsers} /> Membros ({members.length})</h4>
                    {loading && members.length === 0 ? <div className="text-center py-4 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin /></div> : (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y max-h-60 overflow-y-auto">
                            {members.map(member => (
                                <div key={member.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">{member.nome}</p>
                                        <p className="text-xs text-gray-500">{member.telefone}</p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {member.etapa && (
                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 flex items-center gap-1">
                                                <FontAwesomeIcon icon={faFilter} className="text-[8px] opacity-50" />
                                                {member.etapa}
                                            </span>
                                        )}
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{member.tipo || 'Contato'}</span>
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