'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faBullhorn, faUsers, faPaperPlane, faSpinner, faArrowLeft, 
    faClock, faCheckCircle, faTimesCircle, faCalendarAlt, 
    faEdit, faTrash, faPlay, faSync, faBolt, faLock, faCog
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TemplateMessageModal from './TemplateMessageModal';
import CreateBroadcastModal from './CreateBroadcastModal'; // NOVO IMPORT

export default function BroadcastPanel({ list, onBack }) {
    const [members, setMembers] = useState([]);
    const [broadcasts, setBroadcasts] = useState([]); 
    const [loading, setLoading] = useState(false);
    
    // Estados do Modal
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isEditListOpen, setIsEditListOpen] = useState(false); // NOVO: Edição de Lista
    const [editingBroadcast, setEditingBroadcast] = useState(null);
    
    const [sending, setSending] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [stats, setStats] = useState(null);
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);

    const supabase = createClient();

    // 1. BUSCA DADOS
    const fetchData = useCallback(async () => {
        if (!list?.id) return;
        setLoading(true);
        
        // Busca Membros
        const { data: membersData } = await supabase
            .from('whatsapp_list_members')
            .select('contatos(id, nome, telefones(telefone), tipo_contato)')
            .eq('lista_id', list.id);
            
        if (membersData) {
            const formatted = membersData.map(m => ({
                id: m.contatos?.id, 
                nome: m.contatos?.nome, 
                telefone: m.contatos?.telefones?.[0]?.telefone, 
                tipo: m.contatos?.tipo_contato
            })).filter(c => c.telefone);
            setMembers(formatted);
        }

        // Busca Histórico
        const { data: broadcastsData } = await supabase
            .from('whatsapp_scheduled_broadcasts')
            .select('*')
            .eq('lista_id', list.id)
            .order('scheduled_at', { ascending: false });
            
        if (broadcastsData) setBroadcasts(broadcastsData);
        setLoading(false);
    }, [list, supabase]);

    // 2. EFEITOS
    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (!list?.id) return;
        const channel = supabase.channel(`broadcasts-${list.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_scheduled_broadcasts', filter: `lista_id=eq.${list.id}` }, () => { fetchData(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [list, supabase, fetchData]);

    // 3. AÇÕES
    
    // Recarregar após edição da lista
    const handleListUpdated = () => {
        fetchData(); // Atualiza membros e nome
        toast.success("Lista atualizada com sucesso!");
    };

    const handleSyncList = async () => {
        setSyncing(true);
        toast.info("Atualizando lista...");
        try {
            const response = await fetch('/api/whatsapp/lists/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ list_id: list.id })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast.success(result.message);
            fetchData();
        } catch (error) {
            toast.error("Erro: " + error.message);
        } finally {
            setSyncing(false);
        }
    };

    const handleSendBroadcast = async (templateName, language, variables, fullText, components, scheduledAt, editingId) => {
        setSending(true);
        setStats(null);
        try {
            const url = editingId ? '/api/whatsapp/scheduled-broadcasts' : '/api/whatsapp/broadcast/send';
            const method = editingId ? 'PUT' : 'POST';
            
            const payload = {
                id: editingId, 
                list_id: list.id,
                template_name: templateName,
                language,
                variables,
                full_text_base: fullText,
                components, 
                scheduled_at: scheduledAt 
            };

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            if (editingId) toast.success("Agendamento atualizado!");
            else if (result.scheduled) toast.success(`Agendado para ${new Date(result.date).toLocaleString()}!`);
            else {
                setStats(result.stats);
                toast.success("Disparo concluído!");
            }
            setIsTemplateModalOpen(false);
            setEditingBroadcast(null);
            fetchData();
        } catch (error) {
            toast.error("Erro: " + error.message);
        } finally {
            setSending(false);
        }
    };

    const handleDeleteBroadcast = async (id) => {
        if (!confirm("Cancelar agendamento?")) return;
        try {
            await fetch(`/api/whatsapp/scheduled-broadcasts?id=${id}`, { method: 'DELETE' });
            toast.success("Cancelado.");
            fetchData();
        } catch (error) { toast.error("Erro."); }
    };

    const handleProcessQueue = async () => {
        setIsProcessingQueue(true);
        toast.info("Processando fila...");
        try {
            await fetch('/api/cron/process-broadcasts');
            toast.success("Processado!");
            fetchData();
        } catch (error) { toast.error("Erro."); } finally { setIsProcessingQueue(false); }
    };

    const handleEditBroadcast = (b) => { setEditingBroadcast(b); setIsTemplateModalOpen(true); };
    const handleOpenNew = () => { setEditingBroadcast(null); setIsTemplateModalOpen(true); };

    const getStatusInfo = (b) => {
        if (b.status === 'completed') return { icon: faCheckCircle, color: 'text-green-500', label: 'Enviado', bg: 'bg-green-50 border-green-100' };
        if (b.status === 'failed') return { icon: faTimesCircle, color: 'text-red-500', label: 'Falhou', bg: 'bg-red-50 border-red-100' };
        if (b.status === 'processing') return { icon: faSpinner, color: 'text-blue-500', label: 'Enviando...', bg: 'bg-blue-50 border-blue-100', spin: true };
        const isFuture = new Date(b.scheduled_at) > new Date();
        return { icon: faClock, color: isFuture ? 'text-yellow-600' : 'text-orange-500', label: isFuture ? 'Agendado' : 'Na Fila', bg: 'bg-yellow-50 border-yellow-100' };
    };

    const hasPendingQueue = broadcasts.some(b => b.status === 'pending' && new Date(b.scheduled_at) <= new Date());

    if (!list) return null;

    return (
        <div className="flex flex-col h-full bg-[#efeae2] relative">
            {/* Modal de Template */}
            <TemplateMessageModal 
                isOpen={isTemplateModalOpen}
                onClose={() => { setIsTemplateModalOpen(false); setEditingBroadcast(null); }}
                onSendTemplate={handleSendBroadcast}
                contactName="{{1}}" 
                showScheduling={true}
                initialData={editingBroadcast}
            />

            {/* Modal de Edição de Lista */}
            <CreateBroadcastModal 
                isOpen={isEditListOpen}
                onClose={() => setIsEditListOpen(false)}
                onListCreated={handleListUpdated}
                initialData={list} // Passa a lista atual para edição
            />

            {/* Cabeçalho */}
            <div className="bg-[#f0f2f5] px-4 py-2 border-b border-gray-300 flex items-center gap-3 shadow-sm h-16 justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                    {onBack && <button onClick={onBack} className="md:hidden text-[#54656f] p-2 -ml-2 rounded-full hover:bg-black/5"><FontAwesomeIcon icon={faArrowLeft} /></button>}
                    
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${list.is_dynamic ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-500'}`}>
                        <FontAwesomeIcon icon={list.is_dynamic ? faBolt : faLock} />
                    </div>
                    
                    <div className="flex-grow min-w-0">
                        <h3 className="font-medium text-[#111b21] truncate flex items-center gap-2">
                            {list.nome}
                            {/* BOTÃO EDITAR LISTA */}
                            <button onClick={() => setIsEditListOpen(true)} className="text-gray-400 hover:text-[#00a884] text-xs transition-colors" title="Editar Lista">
                                <FontAwesomeIcon icon={faEdit} />
                            </button>
                        </h3>
                        <p className="text-xs text-[#667781] flex items-center gap-1">
                            {list.is_dynamic ? 'Lista Dinâmica' : 'Lista Manual'} • {members.length} membros
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* BOTÃO DE SINCRONIZAR */}
                    {list.is_dynamic && (
                        <button onClick={handleSyncList} disabled={syncing} className="text-[#00a884] hover:bg-[#00a884]/10 p-2 rounded-full transition-colors flex-shrink-0" title="Sincronizar">
                            <FontAwesomeIcon icon={faSync} spin={syncing} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-grow p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                {/* Cartão de Ação */}
                <div className="bg-white p-6 rounded-lg shadow-sm text-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Nova Transmissão</h2>
                    <p className="text-gray-600 mb-6 text-sm">Envie uma mensagem para todos os <span className="font-bold">{members.length}</span> contatos.</p>
                    {sending ? (
                        <div className="flex flex-col items-center gap-2 text-[#00a884]"><FontAwesomeIcon icon={faSpinner} spin size="2x" /><p className="font-medium">Processando...</p></div>
                    ) : stats ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                            <h4 className="font-bold text-green-800 mb-1">Resultado</h4>
                            <p className="text-sm text-green-700">✅ {stats.success} enviados / ❌ {stats.failed} falhas</p>
                            <button onClick={() => setStats(null)} className="mt-3 text-xs text-green-800 underline">Novo disparo</button>
                        </div>
                    ) : (
                        <button onClick={handleOpenNew} disabled={members.length === 0} className="bg-[#00a884] text-white px-6 py-3 rounded-lg hover:bg-[#008f6f] flex items-center justify-center gap-2 mx-auto disabled:opacity-50"><FontAwesomeIcon icon={faPaperPlane} /> Criar Mensagem</button>
                    )}
                </div>

                {/* Histórico */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2"><FontAwesomeIcon icon={faCalendarAlt} /> Histórico</h4>
                        {hasPendingQueue && <button onClick={handleProcessQueue} disabled={isProcessingQueue} className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-200 font-bold flex items-center gap-2 animate-pulse">{isProcessingQueue ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlay} />} Forçar Envio</button>}
                    </div>
                    {broadcasts.length === 0 ? <p className="text-sm text-gray-400 italic ml-1">Nenhum histórico.</p> : (
                        <div className="space-y-2">
                            {broadcasts.map(broadcast => {
                                const statusInfo = getStatusInfo(broadcast);
                                const isPending = broadcast.status === 'pending';
                                return (
                                    <div key={broadcast.id} className={`p-4 rounded-lg border flex items-center justify-between ${statusInfo.bg}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center ${statusInfo.color} shadow-sm`}><FontAwesomeIcon icon={statusInfo.icon} spin={statusInfo.spin} /></div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-800">{broadcast.template_name.replace(/_/g, ' ')}</p>
                                                <p className="text-xs text-gray-500">{format(new Date(broadcast.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={`text-xs font-bold px-2 py-1 rounded bg-white ${statusInfo.color} shadow-sm`}>{statusInfo.label}</div>
                                            {isPending && (
                                                <>
                                                    <button onClick={() => handleEditBroadcast(broadcast)} className="w-7 h-7 rounded-full bg-white text-blue-500 hover:bg-blue-100 flex items-center justify-center shadow-sm"><FontAwesomeIcon icon={faEdit} /></button>
                                                    <button onClick={() => handleDeleteBroadcast(broadcast.id)} className="w-7 h-7 rounded-full bg-white text-red-500 hover:bg-red-100 flex items-center justify-center shadow-sm"><FontAwesomeIcon icon={faTrash} /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Membros */}
                <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><FontAwesomeIcon icon={faUsers} /> Membros ({members.length})</h4>
                    {loading && members.length === 0 ? <div className="text-center py-4 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin /></div> : (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y">
                            {members.map(member => (
                                <div key={member.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                    <div><p className="font-medium text-gray-800 text-sm">{member.nome}</p><p className="text-xs text-gray-500">{member.telefone}</p></div>
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{member.tipo || 'Contato'}</span>
                                </div>
                            ))}
                            {members.length === 0 && <div className="p-4 text-center text-gray-400 text-sm">Lista vazia.</div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}