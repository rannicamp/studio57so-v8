'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullhorn, faUsers, faPaperPlane, faSpinner, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import TemplateMessageModal from './TemplateMessageModal';

export default function BroadcastPanel({ list, onBack }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [stats, setStats] = useState(null); // { success: 0, failed: 0 }

    const supabase = createClient();

    // Carregar membros ao abrir
    useEffect(() => {
        if (list?.id) {
            const fetchMembers = async () => {
                setLoading(true);
                const { data } = await supabase
                    .from('whatsapp_list_members')
                    .select('contatos(id, nome, telefones(telefone), tipo_contato)')
                    .eq('lista_id', list.id);
                
                if (data) {
                    const formatted = data.map(m => ({
                        id: m.contatos?.id,
                        nome: m.contatos?.nome,
                        telefone: m.contatos?.telefones?.[0]?.telefone,
                        tipo: m.contatos?.tipo_contato
                    })).filter(c => c.telefone); // Garante que tem telefone
                    setMembers(formatted);
                }
                setLoading(false);
            };
            fetchMembers();
        }
    }, [list, supabase]);

    // Função atualizada para lidar com o envio (incluindo agendamento e componentes extras)
    const handleSendBroadcast = async (templateName, language, variables, fullText, components, scheduledAt) => {
        setSending(true);
        setStats(null);
        
        if (scheduledAt) toast.info("Agendando disparo...");
        else toast.info("Iniciando disparo... Isso pode levar alguns segundos.");

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
                    components, // Mídia (imagem/vídeo/documento)
                    scheduled_at: scheduledAt // Data de agendamento (ou null)
                })
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.error || "Erro no disparo");

            if (result.scheduled) {
                toast.success(`Agendado para ${new Date(result.date).toLocaleString()}!`);
            } else {
                setStats(result.stats);
                toast.success(`Disparo concluído! Enviado para ${result.stats.success} contatos.`);
            }
            setIsTemplateModalOpen(false);

        } catch (error) {
            console.error(error);
            toast.error("Erro ao realizar disparo: " + error.message);
        } finally {
            setSending(false);
        }
    };

    if (!list) return null;

    return (
        <div className="flex flex-col h-full bg-[#efeae2] relative">
            
            {/* Modal de Template */}
            <TemplateMessageModal 
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onSendTemplate={handleSendBroadcast}
                contactName="{{1}}" // Placeholder visual para indicar que o nome será substituído
                showScheduling={true} // Habilita a opção de agendamento neste modal
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

            {/* Corpo */}
            <div className="flex-grow p-6 overflow-y-auto custom-scrollbar">
                
                {/* Cartão de Ação */}
                <div className="bg-white p-6 rounded-lg shadow-sm mb-6 text-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Nova Transmissão</h2>
                    <p className="text-gray-600 mb-6 text-sm">
                        Envie uma mensagem de modelo para todos os <span className="font-bold">{members.length}</span> contatos desta lista.
                        O sistema personalizará o nome automaticamente.
                    </p>
                    
                    {sending ? (
                        <div className="flex flex-col items-center gap-2 text-[#00a884]">
                            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                            <p className="font-medium">Enviando mensagens... Por favor aguarde.</p>
                            <p className="text-xs text-gray-500">Não feche esta janela.</p>
                        </div>
                    ) : stats ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                            <h4 className="font-bold text-green-800 mb-1">Relatório de Envio</h4>
                            <p className="text-sm text-green-700">
                                ✅ Sucesso: {stats.success} <br/>
                                ❌ Falhas: {stats.failed}
                            </p>
                            <button 
                                onClick={() => setStats(null)}
                                className="mt-3 text-xs text-green-800 underline"
                            >
                                Fazer novo disparo
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsTemplateModalOpen(true)}
                            disabled={members.length === 0}
                            className="bg-[#00a884] text-white px-6 py-3 rounded-lg hover:bg-[#008f6f] flex items-center justify-center gap-2 mx-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FontAwesomeIcon icon={faPaperPlane} />
                            Criar Mensagem
                        </button>
                    )}
                </div>

                {/* Lista de Membros */}
                <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                        <FontAwesomeIcon icon={faUsers} /> Membros da Lista
                    </h4>
                    
                    {loading ? (
                        <div className="text-center py-4 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin /></div>
                    ) : (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y">
                            {members.map(member => (
                                <div key={member.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">{member.nome}</p>
                                        <p className="text-xs text-gray-500">{member.telefone}</p>
                                    </div>
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                        {member.tipo || 'Contato'}
                                    </span>
                                </div>
                            ))}
                            {members.length === 0 && (
                                <div className="p-4 text-center text-gray-400 text-sm">Lista vazia.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}