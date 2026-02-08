// Caminho: components/bim/BimNotesList.js
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faExclamationCircle, faCamera, 
    faClock, faMapMarkerAlt, faComment, faPaperPlane, faTrash 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Função auxiliar para data
function timeAgo(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return "agora";
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "a";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mês";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m";
    return "agora";
}

// Configuração dos Status (Cor e Próximo Passo)
const STATUS_CONFIG = {
    'aberta': { 
        label: 'Aberta', 
        color: 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100', 
        next: 'em_analise' 
    },
    'em_analise': { 
        label: 'Em Análise', 
        color: 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100', 
        next: 'concluida' 
    },
    'concluida': { 
        label: 'Concluída', 
        color: 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100', 
        next: 'aberta' 
    }
};

export default function BimNotesList({ onSelectNote }) {
    const supabase = createClient();
    const { organizacao_id, user } = useAuth();
    const queryClient = useQueryClient();

    // Estado para controlar qual nota está com o chat aberto
    const [openChatId, setOpenChatId] = useState(null);
    const [newComment, setNewComment] = useState("");

    // --- QUERY: Buscar Notas (Filtrando Excluídos) ---
    const { data: notes = [], isLoading, error } = useQuery({
        queryKey: ['bimNotes', organizacao_id],
        queryFn: async () => {
            if (!organizacao_id) return [];
            
            console.log("🔍 Buscando notas...");

            const { data, error } = await supabase
                .from('bim_notas')
                .select(`
                    *,
                    usuario:usuarios!bim_notas_usuario_fkey (nome, sobrenome, avatar_url, email),
                    atividade:activities(nome),
                    comentarios:bim_notas_comentarios (
                        id, texto, criado_em,
                        usuario:usuarios!bim_comentarios_user_fkey (nome, avatar_url)
                    )
                `)
                .eq('organizacao_id', organizacao_id)
                .eq('excluido', false) // <--- O PULO DO GATO: Filtra o Soft Delete
                .order('criado_em', { ascending: false });
            
            if (error) {
                console.error("❌ Erro Supabase:", error);
                throw error;
            }
            return data;
        },
        enabled: !!organizacao_id
    });

    // --- MUTATION 1: Enviar Comentário ---
    const { mutate: sendComment, isPending: isSending } = useMutation({
        mutationFn: async ({ notaId, texto }) => {
            if (!user?.id) throw new Error("Usuário não identificado");
            
            const { error } = await supabase
                .from('bim_notas_comentarios')
                .insert({
                    nota_id: notaId,
                    usuario_id: user.id,
                    texto: texto
                });
            if (error) throw error;
        },
        onSuccess: () => {
            setNewComment("");
            queryClient.invalidateQueries(['bimNotes']);
        },
        onError: (e) => toast.error("Erro ao comentar: " + e.message)
    });

    // --- MUTATION 2: Mudar Status (Ciclo) ---
    const { mutate: changeStatus } = useMutation({
        mutationFn: async ({ notaId, currentStatus }) => {
            // Descobre qual é o próximo status baseado na config
            const nextStatus = STATUS_CONFIG[currentStatus]?.next || 'aberta';

            const { error } = await supabase
                .from('bim_notas')
                .update({ status: nextStatus, atualizado_em: new Date() })
                .eq('id', notaId);
            
            if (error) throw error;
            return nextStatus;
        },
        onSuccess: (newStatus) => {
            toast.success(`Status alterado para: ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
            queryClient.invalidateQueries(['bimNotes']);
        },
        onError: (e) => toast.error("Erro ao mudar status: " + e.message)
    });

    // --- MUTATION 3: Soft Delete (Lixeira) ---
    const { mutate: softDeleteNote } = useMutation({
        mutationFn: async (notaId) => {
            if(!confirm("Tem certeza que deseja remover esta nota?")) return null; // Cancela se o usuário desistir

            const { error } = await supabase
                .from('bim_notas')
                .update({ excluido: true, atualizado_em: new Date() }) // Marca como excluído
                .eq('id', notaId);
            
            if (error) throw error;
            return "deleted";
        },
        onSuccess: (result) => {
            if (result === "deleted") {
                toast.success("Nota movida para lixeira.");
                queryClient.invalidateQueries(['bimNotes']);
            }
        },
        onError: (e) => toast.error("Erro ao excluir: " + e.message)
    });

    const handleCommentSubmit = (e, notaId) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        sendComment({ notaId, texto: newComment });
    };

    if (isLoading) return <div className="p-8 text-center text-gray-400 text-xs"><FontAwesomeIcon icon={faSpinner} spin /> Carregando feed...</div>;
    
    if (error) return <div className="p-4 text-center text-red-400 text-xs">Erro ao carregar notas. Verifique o console.</div>;

    if (notes.length === 0) return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-300">
            <div className="bg-gray-50 p-4 rounded-full mb-3"><FontAwesomeIcon icon={faCamera} className="text-2xl" /></div>
            <p className="text-sm font-medium text-gray-400">Nenhuma nota registrada</p>
        </div>
    );

    return (
        <div className="p-3 space-y-4 bg-gray-50/50 min-h-full pb-20">
            {notes.map(note => {
                const userObj = note.usuario || {};
                const fullName = userObj.nome ? `${userObj.nome} ${userObj.sobrenome || ''}` : "Usuário";
                const initials = userObj.nome ? userObj.nome.substring(0, 1).toUpperCase() : "U";
                
                const commentsList = note.comentarios || [];
                const commentCount = commentsList.length;
                const isChatOpen = openChatId === note.id;

                // Configuração do Status Atual
                const statusInfo = STATUS_CONFIG[note.status] || STATUS_CONFIG['aberta'];

                return (
                    <div key={note.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden group hover:shadow-md transition-all">
                        
                        {/* HEADER DA NOTA */}
                        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50 bg-white">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden border border-gray-100 shadow-sm">
                                    {userObj.avatar_url ? (
                                        <img src={userObj.avatar_url} alt={fullName} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold">{initials}</div>
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-gray-800 leading-tight truncate max-w-[120px]">{fullName}</span>
                                    <span className="text-[9px] text-gray-400 flex items-center gap-1"><FontAwesomeIcon icon={faClock} className="text-[8px]" /> {timeAgo(note.criado_em)}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Botão de Status Clicável */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); changeStatus({ notaId: note.id, currentStatus: note.status }); }}
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border cursor-pointer transition-all active:scale-95 select-none ${statusInfo.color}`}
                                    title="Clique para avançar o status"
                                >
                                    {statusInfo.label}
                                </button>

                                {/* Botão de Lixeira (Soft Delete) */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); softDeleteNote(note.id); }}
                                    className="w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                                    title="Excluir Nota"
                                >
                                    <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                                </button>
                            </div>
                        </div>

                        {/* CONTEÚDO */}
                        <div className="p-4 pt-3 cursor-pointer" onClick={() => onSelectNote && onSelectNote(note)}>
                            <h4 className="text-sm font-bold text-gray-800 mb-1 leading-snug group-hover:text-purple-600 transition-colors">{note.titulo}</h4>
                            {note.descricao && <p className="text-xs text-gray-500 mb-3 line-clamp-3 leading-relaxed">{note.descricao}</p>}
                            
                            <div className="flex flex-wrap gap-2 mb-3">
                                {note.prioridade === 'critica' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-700 text-[9px] font-bold"><FontAwesomeIcon icon={faExclamationCircle} /> Crítica</span>}
                                {note.atividade && <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-[9px] font-medium border border-blue-100 truncate"><FontAwesomeIcon icon={faMapMarkerAlt} /> {note.atividade.nome}</span>}
                            </div>

                            {note.snapshot && (
                                <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative mt-2 group/img">
                                    <img src={note.snapshot} alt="Vista" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                        <span className="opacity-0 group-hover/img:opacity-100 bg-white/90 text-gray-800 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm transition-all transform translate-y-2 group-hover/img:translate-y-0"><FontAwesomeIcon icon={faCamera} className="mr-1" /> Ver no Modelo</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RODAPÉ DE AÇÕES */}
                        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setOpenChatId(isChatOpen ? null : note.id); }} 
                                className={`text-[10px] font-bold flex items-center gap-1 transition-colors ${isChatOpen ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <FontAwesomeIcon icon={faComment} /> 
                                {commentCount > 0 ? `${commentCount} Respostas` : 'Responder'}
                            </button>
                        </div>

                        {/* CHAT */}
                        {isChatOpen && (
                            <div className="bg-gray-50 px-4 pb-4 animate-in slide-in-from-top-2 border-t border-gray-200">
                                <div className="space-y-3 py-3 max-h-40 overflow-y-auto custom-scrollbar">
                                    {commentsList.length > 0 ? (
                                        commentsList.map(comment => (
                                            <div key={comment.id} className="flex gap-2 animate-in fade-in slide-in-from-bottom-1">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden shrink-0 mt-1 border border-gray-300">
                                                    {comment.usuario?.avatar_url ? (
                                                        <img src={comment.usuario.avatar_url} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gray-400 flex items-center justify-center text-[8px] text-white font-bold">{comment.usuario?.nome?.[0] || '?'}</div>
                                                    )}
                                                </div>
                                                <div className="bg-white p-2 rounded-lg rounded-tl-none border border-gray-200 shadow-sm flex-1">
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <span className="text-[10px] font-bold text-gray-700">{comment.usuario?.nome || 'Usuário'}</span>
                                                        <span className="text-[8px] text-gray-400">{timeAgo(comment.criado_em)}</span>
                                                    </div>
                                                    <p className="text-[10px] text-gray-600 leading-snug">{comment.texto}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[10px] text-center text-gray-400 italic py-2">Seja o primeiro a responder.</p>
                                    )}
                                </div>

                                <form onSubmit={(e) => handleCommentSubmit(e, note.id)} className="flex gap-2 mt-2">
                                    <input 
                                        type="text" 
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Escreva uma resposta..." 
                                        className="flex-1 text-xs px-3 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                                        autoFocus
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!newComment.trim() || isSending}
                                        className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                                    >
                                        {isSending ? <FontAwesomeIcon icon={faSpinner} spin className="text-xs"/> : <FontAwesomeIcon icon={faPaperPlane} className="text-xs"/>}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}