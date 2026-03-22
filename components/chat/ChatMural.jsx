"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faHeart as faHeartSolid, faCommentDots, faPaperPlane, faChevronDown, faChevronUp, faWandMagicSparkles, faEllipsisV, faTrash, faTasks } from '@fortawesome/free-solid-svg-icons';
import { faHeart as faHeartRegular } from '@fortawesome/free-regular-svg-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMuralPosts, useCreateMuralPost, useCreateMuralComment, useToggleMuralLike, useMuralAISuggestion, useDeleteMuralPost } from './ChatMuralHooks';
import { toast } from 'sonner';
import AtividadeModal from '@/components/atividades/AtividadeModal';

function MuralPost({ post, user, onConvertPost }) {
    const [showComments, setShowComments] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [newComment, setNewComment] = useState('');
    const toggleLikeMutation = useToggleMuralLike();
    const createCommentMutation = useCreateMuralComment();
    const deletePostMutation = useDeleteMuralPost();

    const isLiked = post.likes?.some(l => l.user_id === user?.id);
    const authorName = post.author?.sobrenome ? `${post.author.nome} ${post.author.sobrenome}` : post.author?.nome || 'Usuário';

    const handleLike = () => toggleLikeMutation.mutate({ postId: post.id, isLiked });
    
    const handleComment = (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        createCommentMutation.mutate({ postId: post.id, conteudo: newComment.trim() }, {
            onSuccess: () => setNewComment('')
        });
    };

    const handleDelete = () => {
        if(!confirm("Tem certeza que deseja excluir esta publicação?")) return;
        deletePostMutation.mutate(post.id, {
            onSuccess: () => toast.success("Publicação excluída.")
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] border border-gray-100 p-4 shrink-0 transition-all hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.1)]">
            {/* Header: Author + Date */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    {post.author?.avatar_url ? (
                        <img src={post.author.avatar_url} className="w-10 h-10 rounded-full object-cover shadow-sm bg-gray-50 border border-gray-100" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
                            {authorName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="text-[14px] font-semibold text-gray-800 leading-tight">{authorName}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">{post.author?.funcoes?.nome_funcao || 'Equipe'}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span className="text-[10px] text-gray-400">
                                {new Date(post.created_at).toLocaleDateString('pt-BR')} às {new Date(post.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3 dots menu */}
                <div className="relative">
                    <button onClick={() => setShowOptions(!showOptions)} className="text-gray-400 hover:text-gray-600 p-1 px-2 rounded-full transition-colors flex items-center justify-center">
                        <FontAwesomeIcon icon={faEllipsisV} />
                    </button>
                    {showOptions && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 shadow-lg rounded-xl z-20 py-1 overflow-hidden" onMouseLeave={() => setShowOptions(false)}>
                            <button 
                                onClick={() => { setShowOptions(false); onConvertPost(post); }}
                                className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faTasks} className="text-gray-400 w-4" /> Criar Atividade
                            </button>
                            {post.author_id === user?.id && (
                                <button 
                                    onClick={() => { setShowOptions(false); handleDelete(); }}
                                    className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <FontAwesomeIcon icon={faTrash} className="w-4" /> Excluir Postagem
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="mb-3">
                <h4 className="text-[15px] font-bold text-gray-900 mb-1 leading-snug">{post.assunto}</h4>
                <div className="max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                    <p className="text-[13.5px] text-gray-700 leading-relaxed whitespace-pre-wrap">{post.conteudo}</p>
                </div>
            </div>

            {/* Actions (Like / Comment toggle) */}
            <div className="flex items-center gap-4 border-t border-gray-100 pt-3 mt-1">
                <button onClick={handleLike} className={`flex items-center gap-1.5 text-[13px] font-medium transition-colors ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}>
                    <FontAwesomeIcon icon={isLiked ? faHeartSolid : faHeartRegular} className={isLiked ? 'scale-110 transition-transform' : ''} />
                    <span>{post.likes?.length || 0}</span> Curtir
                </button>
                <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500 hover:text-indigo-500 transition-colors">
                    <FontAwesomeIcon icon={faCommentDots} />
                    <span>{post.comments?.length || 0}</span> Comentários
                    <FontAwesomeIcon icon={showComments ? faChevronUp : faChevronDown} className="text-[10px] ml-1 opacity-70" />
                </button>
            </div>

            {/* Comments Space (Collapsible) */}
            {showComments && (
                <div className="mt-4 pt-3 border-t border-gray-50 flex flex-col gap-3">
                    {post.comments?.length > 0 ? (
                        <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                            {post.comments.map(c => {
                                const cName = c.author?.sobrenome ? `${c.author.nome} ${c.author.sobrenome}` : c.author?.nome || 'Usuário';
                                return (
                                    <div key={c.id} className="flex gap-2.5">
                                        {c.author?.avatar_url ? (
                                            <img src={c.author.avatar_url} className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5 border border-gray-100" />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                                {cName.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-3 py-2 flex-1">
                                            <div className="flex items-baseline justify-between mb-0.5">
                                                <span className="text-[12px] font-semibold text-gray-800">{cName}</span>
                                                <span className="text-[9px] text-gray-400">{new Date(c.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <p className="text-[13px] text-gray-700 leading-snug">{c.conteudo}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-center text-[12px] text-gray-400 italic">Nenhum comentário ainda. Seja o primeiro!</p>
                    )}
                    
                    {/* Add Comment Input */}
                    <form onSubmit={handleComment} className="flex gap-2 items-center mt-1">
                        <input 
                            type="text" 
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Escreva um comentário..."
                            maxLength={500}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                        />
                        <button 
                            type="submit" 
                            disabled={!newComment.trim() || createCommentMutation.isPending}
                            className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0 shadow-sm"
                        >
                            {createCommentMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin className="text-[12px]" /> : <FontAwesomeIcon icon={faPaperPlane} className="text-[12px] ml-[-1px]" />}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

export default function ChatMural() {
    const { user } = useAuth();
    const { data: posts, isLoading } = useMuralPosts();
    const createPostMutation = useCreateMuralPost();
    const aiMutation = useMuralAISuggestion();

    const [postToConvert, setPostToConvert] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [assunto, setAssunto] = useState('');
    const [conteudo, setConteudo] = useState('');

    const handleAiMagic = () => {
        if (!conteudo.trim()) {
            toast.error("Você precisa digitar um rascunho de texto primeiro!");
            return;
        }

        const promessa = new Promise((resolve, reject) => {
            aiMutation.mutate({ text: conteudo.trim(), assuntoAtual: assunto.trim() }, {
                onSuccess: (data) => {
                    setAssunto(data.assunto);
                    setConteudo(data.conteudo);
                    resolve(data);
                },
                onError: (err) => {
                    console.error("Erro AI:", err);
                    reject(err);
                }
            });
        });

        toast.promise(promessa, {
            loading: 'Devonildo está polindo seu texto...',
            success: 'Mágica concluída! Texto aprimorado✨',
            error: (err) => `Erro: ${err.message}`
        });
    };

    const handleCreatePost = (e) => {
        e.preventDefault();
        if(!assunto.trim() || !conteudo.trim()) return;

        createPostMutation.mutate({ assunto: assunto.trim(), conteudo: conteudo.trim() }, {
            onSuccess: () => {
                setAssunto('');
                setConteudo('');
                setIsCreating(false);
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-4">
                <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-indigo-300 mb-2" />
                <span className="text-sm text-gray-500 mt-2">Carregando o mural...</span>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
            {/* Create Post Header Button */}
            <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 shadow-sm z-10">
                <h3 className="font-semibold text-gray-800">Mural de Recados</h3>
                <button 
                    onClick={() => setIsCreating(!isCreating)}
                    className="px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                    {isCreating ? 'Cancelar' : 'Nova Publicação'}
                </button>
            </div>

            {/* Create Post Form Dropdown */}
            {isCreating && (
                <div className="bg-white p-4 border-b border-gray-100 shadow-md animate-in slide-in-from-top-2 shrink-0 z-0">
                    <form onSubmit={handleCreatePost} className="flex flex-col gap-3">
                        <input
                            type="text"
                            placeholder="Assunto da Publicação..."
                            value={assunto}
                            maxLength={100}
                            onChange={(e) => setAssunto(e.target.value)}
                            className="w-full border-b border-gray-200 px-2 py-2 text-[14px] font-semibold text-gray-800 outline-none focus:border-indigo-500 transition-colors"
                        />
                        <textarea
                            placeholder="Escreva sua mensagem para toda a equipe..."
                            value={conteudo}
                            maxLength={2000}
                            onChange={(e) => setConteudo(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-[13.5px] resize-none outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all min-h-[80px]"
                        />
                        <div className="flex justify-between items-center mt-1 gap-2">
                            <button 
                                type="button"
                                onClick={handleAiMagic}
                                disabled={!conteudo.trim() || aiMutation.isPending}
                                className="px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-semibold shadow-sm text-[12px] hover:shadow-md hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                                title="Corrigir e melhorar com IA"
                            >
                                {aiMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faWandMagicSparkles} />} Magia IA
                            </button>
                            <button 
                                type="submit"
                                disabled={!assunto.trim() || !conteudo.trim() || createPostMutation.isPending}
                                className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow text-[13px] hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                            >
                                {createPostMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Publicar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Feed Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {(!posts || posts.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
                        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                            <span className="text-2xl">📢</span>
                        </div>
                        <h4 className="font-semibold text-gray-800 text-sm mb-1">Mural Vazio</h4>
                        <p className="text-[13px] text-gray-500">Seja o primeiro a publicar um recado para a equipe!</p>
                    </div>
                ) : (
                    posts.map(post => <MuralPost key={post.id} post={post} user={user} onConvertPost={setPostToConvert} />)
                )}
            </div>

            {/* Atividade Modal Conversion */}
            {postToConvert && (
                <AtividadeModal 
                    isOpen={true} 
                    onClose={() => setPostToConvert(null)} 
                    initialData={{ 
                        nome: postToConvert.assunto, 
                        descricao: `[Origem: Mural de Recados]\n\n${postToConvert.conteudo}` 
                    }}
                />
            )}
        </div>
    );
}
