'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faBullhorn, faUsers, faPaperPlane, faSpinner, faArrowLeft, 
    faClock, faCheckCircle, faTimesCircle, faCalendarAlt, 
    faEdit, faTrash, faPlay, faSync, faBolt, faLock, faEye, faCheckDouble
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TemplateMessageModal from './TemplateMessageModal';
import CreateBroadcastModal from './CreateBroadcastModal';

// Componente da Barra de Progresso
const ProgressBar = ({ stats, total }) => {
    if (!total || total === 0) return null;
    
    // Calcula porcentagens
    const sentPct = Math.round(((stats.sent || 0) / total) * 100);
    const deliveredPct = Math.round(((stats.delivered || 0) / total) * 100);
    const readPct = Math.round(((stats.read || 0) / total) * 100);
    const failedPct = Math.round(((stats.failed || 0) / total) * 100);

    return (
        <div className="w-full mt-2">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase font-bold tracking-wide">
                <span>Progresso</span>
                <span>{readPct}% Lido</span>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden flex">
                {/* Lido (Verde Escuro) */}
                <div style={{ width: `${readPct}%` }} className="h-full bg-green-600 transition-all duration-500" title="Lido" />
                {/* Entregue (Verde Claro) - desconta o lido para não somar 2x visualmente se quiser empilhar, mas aqui faremos sobreposto ou sequencial */}
                <div style={{ width: `${Math.max(0, deliveredPct - readPct)}%` }} className="h-full bg-green-400 transition-all duration-500" title="Entregue" />
                {/* Enviado (Cinza/Azul) */}
                <div style={{ width: `${Math.max(0, sentPct - deliveredPct)}%` }} className="h-full bg-blue-300 transition-all duration-500" title="Enviado" />
                {/* Falha (Vermelho) */}
                <div style={{ width: `${failedPct}%` }} className="h-full bg-red-400 transition-all duration-500" title="Falha" />
            </div>
            <div className="flex gap-3 mt-1 text-[10px] text-gray-600">
                <span className="flex items-center gap-1"><FontAwesomeIcon icon={faCheckDouble} className="text-green-600" /> {stats.read || 0} Lidos</span>
                <span className="flex items-center gap-1"><FontAwesomeIcon icon={faCheckDouble} className="text-green-400" /> {stats.delivered || 0} Entregues</span>
                <span className="flex items-center gap-1"><FontAwesomeIcon icon={faTimesCircle} className="text-red-400" /> {stats.failed || 0} Erros</span>
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

    const fetchData = useCallback(async () => {
        if (!list?.id) return;
        setLoading(true);
        
        // Membros
        const { data: membersData } = await supabase
            .from('whatsapp_list_members')
            .select('contatos(id, nome, telefones(telefone), tipo_contato)')
            .eq('lista_id', list.id);
            
        if (membersData) {
            const formatted = membersData.map(m => ({
                id: m.contatos?.id, nome: m.contatos?.nome, telefone: m.contatos?.telefones?.[0]?.telefone, tipo: m.contatos?.tipo_contato
            })).filter(c => c.telefone);
            setMembers(formatted);
        }

        // Histórico com Estatísticas
        const { data: broadcastsData } = await supabase
            .from('whatsapp_scheduled_broadcasts')
            .select('*')
            .eq('lista_id', list.id)
            .order('scheduled_at', { ascending: false });
            
        if (broadcastsData) {
            // Buscar stats para cada broadcast
            const broadcastsWithStats = await Promise.all(broadcastsData.map(async (b) => {
                // Chama a função RPC que criamos
                const { data: stats } = await supabase.rpc('get_broadcast_stats', { p_broadcast_id: b.id });
                return { ...b, stats: stats || { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 } };
            }));
            setBroadcasts(broadcastsWithStats);
        }
        setLoading(false);
    }, [list, supabase]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Realtime para atualizar stats
    useEffect(() => {
        if (!list?.id) return;
        // Escuta mudanças nas mensagens também para atualizar o "Lido/Entregue" em tempo real
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

    // ... (Funções handleSyncList, handleSendBroadcast, etc. MANTIDAS IGUAIS ao anterior)
    const handleListUpdated = () => { fetchData(); toast.success("Lista atualizada!"); };
    const handleSyncList = async () => { setSyncing(true); try { await fetch('/api/whatsapp/lists/sync', { method: 'POST', body: JSON.stringify({ list_id: list.id }) }); toast.success("Atualizada!"); fetchData(); } catch(e){ toast.error(e.message); } finally { setSyncing(false); } };
    const handleSendBroadcast = async (t, l, v, f, c, s, eid) => { setSending(true); try { const url = eid ? '/api/whatsapp/scheduled-broadcasts' : '/api/whatsapp/broadcast/send'; const method = eid ? 'PUT' : 'POST'; await fetch(url, { method, body: JSON.stringify({ id: eid, list_id: list.id, template_name: t, language: l, variables: v, full_text_base: f, components: c, scheduled_at: s }) }); toast.success("Salvo!"); setIsTemplateModalOpen(false); setEditingBroadcast(null); fetchData(); } catch(e){ toast.error(e.message); } finally { setSending(false); } };
    const handleDeleteBroadcast = async (id) => { if(!confirm("Cancelar?")) return; await fetch(`/api/whatsapp/scheduled-broadcasts?id=${id}`, { method: 'DELETE' }); fetchData(); };
    const handleProcessQueue = async () => { setIsProcessingQueue(true); await fetch('/api/cron/process-broadcasts'); fetchData(); setIsProcessingQueue(false); };
    const handleEditBroadcast = (b) => { setEditingBroadcast(b); setIsTemplateModalOpen(true); };
    const handleOpenNew = () => { setEditingBroadcast(null); setIsTemplateModalOpen(true); };

    const getStatusInfo = (b) => {
        if (b.status === 'completed') return { icon: faCheckCircle, color: 'text-green-500', label: 'Concluído', bg: 'bg-white border-green-200' };
        if (b.status === 'failed') return { icon: faTimesCircle, color: 'text-red-500', label: 'Falhou', bg: 'bg-red-50 border-red-100' };
        if (b.status === 'processing') return { icon: faSpinner, color: 'text-blue-500', label: 'Enviando...', bg: 'bg-blue-50 border-blue-100', spin: true };
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

                {/* HISTÓRICO COM GRÁFICOS */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2"><FontAwesomeIcon icon={faCalendarAlt} /> Histórico</h4>
                        {hasPendingQueue && <button onClick={handleProcessQueue} disabled={isProcessingQueue} className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-200 font-bold flex items-center gap-2 animate-pulse">{isProcessingQueue ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlay} />} Forçar Envio</button>}
                    </div>
                    
                    {broadcasts.length === 0 ? <p className="text-sm text-gray-400 italic ml-1">Nenhum histórico.</p> : (
                        <div className="space-y-3">
                            {broadcasts.map(broadcast => {
                                const statusInfo = getStatusInfo(broadcast);
                                const isPending = broadcast.status === 'pending';
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
                                                {isPending ? (
                                                    <>
                                                        <button onClick={() => handleEditBroadcast(broadcast)} className="text-blue-500 hover:bg-blue-50 p-2 rounded"><FontAwesomeIcon icon={faEdit} /></button>
                                                        <button onClick={() => handleDeleteBroadcast(broadcast.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><FontAwesomeIcon icon={faTrash} /></button>
                                                    </>
                                                ) : <div className={`text-xs font-bold px-2 py-1 rounded ${statusInfo.color} bg-white border`}>{statusInfo.label}</div>}
                                            </div>
                                        </div>
                                        
                                        {/* BARRA DE PROGRESSO */}
                                        {broadcast.stats && broadcast.status !== 'pending' && (
                                            <ProgressBar stats={broadcast.stats} total={members.length} />
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
                                    <div><p className="font-medium text-gray-800 text-sm">{member.nome}</p><p className="text-xs text-gray-500">{member.telefone}</p></div>
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{member.tipo || 'Contato'}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}