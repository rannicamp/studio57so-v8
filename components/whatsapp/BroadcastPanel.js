'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faBullhorn, faUsers, faPaperPlane, faSpinner, faArrowLeft, 
    faClock, faCheckCircle, faTimesCircle, faCalendarAlt 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TemplateMessageModal from './TemplateMessageModal';

export default function BroadcastPanel({ list, onBack }) {
    const [members, setMembers] = useState([]);
    const [broadcasts, setBroadcasts] = useState([]); // Lista de agendamentos/histórico
    const [loading, setLoading] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [stats, setStats] = useState(null);

    const supabase = createClient();

    // 1. Carregar Membros e Agendamentos ao abrir
    useEffect(() => {
        if (list?.id) {
            fetchData();
        }
    }, [list, supabase]);

    // 2. Realtime: Atualizar status dos agendamentos automaticamente
    useEffect(() => {
        if (!list?.id) return;

        const channel = supabase.channel(`broadcasts-${list.id}`)
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'whatsapp_scheduled_broadcasts',
                    filter: `lista_id=eq.${list.id}`
                },
                () => {
                    fetchData(); // Recarrega se houver mudança (ex: enviado)
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [list, supabase]);

    const fetchData = async () => {
        setLoading(true);
        
        // Buscar Membros
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

        // Buscar Agendamentos e Histórico
        const { data: broadcastsData } = await supabase
            .from('whatsapp_scheduled_broadcasts')
            .select('*')
            .eq('lista_id', list.id)
            .order('scheduled_at', { ascending: false }); // Mais recentes/futuros primeiro

        if (broadcastsData) {
            setBroadcasts(broadcastsData);
        }

        setLoading(false);
    };

    const handleSendBroadcast = async (templateName, language, variables, fullText, components, scheduledAt) => {
        setSending(true);
        setStats(null);
        
        const toastId = toast.loading(scheduledAt ? "Agendando..." : "Iniciando disparo...");

        try {
            const response = await fetch('/api/whatsapp/broadcast/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    list_id: list.id,
                    template_name: templateName,
                    language,
                    variables,
                    full_text_base: fullText,
                    components, 
                    scheduled_at: scheduledAt 
                })
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.error || "Erro no disparo");

            if (result.scheduled) {
                toast.success(`Agendado para ${new Date(result.date).toLocaleString()}!`, { id: toastId });
            } else {
                setStats(result.stats);
                toast.success(`Concluído! Enviado para ${result.stats.success} contatos.`, { id: toastId });
            }
            setIsTemplateModalOpen(false);
            fetchData(); // Atualiza a lista na hora

        } catch (error) {
            console.error(error);
            toast.error("Erro: " + error.message, { id: toastId });
        } finally {
            setSending(false);
        }
    };

    // Helper para status
    const getStatusInfo = (b) => {
        if (b.status === 'completed') return { icon: faCheckCircle, color: 'text-green-500', label: 'Enviado', bg: 'bg-green-50 border-green-100' };
        if (b.status === 'failed') return { icon: faTimesCircle, color: 'text-red-500', label: 'Falhou', bg: 'bg-red-50 border-red-100' };
        if (b.status === 'processing') return { icon: faSpinner, color: 'text-blue-500', label: 'Enviando...', bg: 'bg-blue-50 border-blue-100', spin: true };
        
        // Pending (Verifica se é futuro ou atrasado)
        const isFuture = new Date(b.scheduled_at) > new Date();
        return { 
            icon: faClock, 
            color: isFuture ? 'text-yellow-600' : 'text-orange-500', 
            label: isFuture ? 'Agendado' : 'Na Fila', 
            bg: 'bg-yellow-50 border-yellow-100' 
        };
    };

    if (!list) return null;

    return (
        <div className="flex flex-col h-full bg-[#efeae2] relative">
            <TemplateMessageModal 
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onSendTemplate={handleSendBroadcast}
                contactName="{{1}}" 
                showScheduling={true} 
            />

            {/* Cabeçalho */}
            <div className="bg-[#f0f2f5] px-4 py-2 border-b border-gray-300 flex items-center gap-3 shadow-sm h-16">
                {onBack && (
                    <button onClick={onBack} className="md:hidden text-[#54656f] p-2 -ml-2 rounded-full hover:bg-black/5">
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                )}
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                    <FontAwesomeIcon icon={faBullhorn} />
                </div>
                <div className="flex-grow">
                    <h3 className="font-medium text-[#111b21]">{list.nome}</h3>
                    <p className="text-xs text-[#667781]">{members.length} destinatários</p>
                </div>
            </div>

            <div className="flex-grow p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                {/* Cartão de Ação */}
                <div className="bg-white p-6 rounded-lg shadow-sm text-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Nova Transmissão</h2>
                    <p className="text-gray-600 mb-6 text-sm">
                        Envie uma mensagem para todos os <span className="font-bold">{members.length}</span> contatos desta lista.
                    </p>
                    
                    {sending ? (
                        <div className="flex flex-col items-center gap-2 text-[#00a884]">
                            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                            <p className="font-medium">Processando...</p>
                        </div>
                    ) : stats ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                            <h4 className="font-bold text-green-800 mb-1">Último Envio</h4>
                            <p className="text-sm text-green-700">✅ {stats.success} enviados / ❌ {stats.failed} falhas</p>
                            <button onClick={() => setStats(null)} className="mt-3 text-xs text-green-800 underline">Novo disparo</button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsTemplateModalOpen(true)}
                            disabled={members.length === 0}
                            className="bg-[#00a884] text-white px-6 py-3 rounded-lg hover:bg-[#008f6f] flex items-center justify-center gap-2 mx-auto disabled:opacity-50 transition-all shadow-sm"
                        >
                            <FontAwesomeIcon icon={faPaperPlane} /> Criar Mensagem
                        </button>
                    )}
                </div>

                {/* --- SEÇÃO DE MENSAGENS PROGRAMADAS / HISTÓRICO --- */}
                <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                        <FontAwesomeIcon icon={faCalendarAlt} /> Mensagens Programadas
                    </h4>
                    
                    {broadcasts.length === 0 ? (
                        <p className="text-sm text-gray-400 italic ml-1">Nenhum agendamento ou histórico recente.</p>
                    ) : (
                        <div className="space-y-2">
                            {broadcasts.map(broadcast => {
                                const statusInfo = getStatusInfo(broadcast);
                                return (
                                    <div key={broadcast.id} className={`p-4 rounded-lg border flex items-center justify-between ${statusInfo.bg}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center ${statusInfo.color} shadow-sm`}>
                                                <FontAwesomeIcon icon={statusInfo.icon} spin={statusInfo.spin} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-800">
                                                    {broadcast.template_name.replace(/_/g, ' ')}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {format(new Date(broadcast.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`text-xs font-bold px-2 py-1 rounded bg-white ${statusInfo.color} shadow-sm`}>
                                            {statusInfo.label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Lista de Membros */}
                <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                        <FontAwesomeIcon icon={faUsers} /> Membros ({members.length})
                    </h4>
                    {loading && members.length === 0 ? <div className="text-center py-4 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin /></div> : (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y">
                            {members.map(member => (
                                <div key={member.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">{member.nome}</p>
                                        <p className="text-xs text-gray-500">{member.telefone}</p>
                                    </div>
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