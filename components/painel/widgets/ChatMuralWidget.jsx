"use client";

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faHeart as faHeartSolid, faCommentDots, faPaperPlane, faChevronDown, faChevronUp, faBullhorn, faWandMagicSparkles, faEllipsisV, faTrash, faTasks } from '@fortawesome/free-solid-svg-icons';
import { faHeart as faHeartRegular } from '@fortawesome/free-regular-svg-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMuralPosts, useCreateMuralPost, useCreateMuralComment, useToggleMuralLike, useMuralAISuggestion, useDeleteMuralPost } from '@/components/chat/ChatMuralHooks';
import { toast } from 'sonner';
import AtividadeModal from '@/components/atividades/AtividadeModal';

function MuralPostCard({ post, user, onConvertPost }) {
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
 <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col hover:shadow-md transition-shadow">
 {/* Header: Author + Date */}
 <div className="flex justify-between items-start mb-4">
 <div className="flex items-center gap-3">
 {post.author?.avatar_url ? (
 <img src={post.author.avatar_url} className="w-11 h-11 rounded-full object-cover shadow-sm bg-gray-50 border border-gray-100" />
 ) : (
 <div className="w-11 h-11 rounded-full bg-blue-600 from-indigo-500 flex items-center justify-center text-white font-bold shadow-sm">
 {authorName.charAt(0).toUpperCase()}
 </div>
 )}
 <div className="flex flex-col">
 <span className="text-[15px] font-bold text-gray-800 leading-tight">{authorName}</span>
 <div className="flex items-center gap-1.5 mt-0.5">
 <span className="text-[11px] text-indigo-600 font-bold tracking-wide uppercase">{post.author?.funcoes?.nome_funcao || 'Equipe'}</span>
 <span className="w-1 h-1 rounded-full bg-gray-300"></span>
 <span className="text-[11px] text-gray-400 font-medium">
 {new Date(post.created_at).toLocaleDateString('pt-BR')} às {new Date(post.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>
 </div>
 </div>

 {/* 3 dots menu */}
 <div className="relative">
 <button onClick={() => setShowOptions(!showOptions)} className="text-gray-400 hover:text-gray-600 p-1.5 px-2.5 rounded-full transition-colors flex items-center justify-center">
 <FontAwesomeIcon icon={faEllipsisV} />
 </button>
 {showOptions && (
 <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 shadow-xl rounded-xl z-20 py-1 overflow-hidden" onMouseLeave={() => setShowOptions(false)}>
 <button onClick={() => { setShowOptions(false); onConvertPost(post); }}
 className="w-full text-left px-4 py-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
 >
 <FontAwesomeIcon icon={faTasks} className="text-gray-400 w-4" /> Criar Atividade
 </button>
 {post.author_id === user?.id && (
 <button onClick={() => { setShowOptions(false); handleDelete(); }}
 className="w-full text-left px-4 py-3 text-[13px] font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
 >
 <FontAwesomeIcon icon={faTrash} className="w-4" /> Excluir Postagem
 </button>
 )}
 </div>
 )}
 </div>
 </div>

 {/* Content */}
 <div className="mb-4 flex-1">
 <h4 className="text-[16px] font-bold text-gray-900 mb-2 leading-snug">{post.assunto}</h4>
 <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
 <p className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap">{post.conteudo}</p>
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center gap-5 border-t border-gray-100 pt-4 mt-auto">
 <button onClick={handleLike} className={`flex items-center gap-2 text-[13px] font-semibold transition-colors ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}>
 <FontAwesomeIcon icon={isLiked ? faHeartSolid : faHeartRegular} className={isLiked ? 'scale-110 transition-transform text-lg' : 'text-lg'} />
 <span>{post.likes?.length || 0}</span> Curtir
 </button>
 <button onClick={() => setShowComments(!showComments)} className={`flex items-center gap-2 text-[13px] font-semibold transition-colors ${showComments ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}>
 <FontAwesomeIcon icon={faCommentDots} className="text-lg" />
 <span>{post.comments?.length || 0}</span> Comentários
 <FontAwesomeIcon icon={showComments ? faChevronUp : faChevronDown} className="text-[10px] ml-1 opacity-70" />
 </button>
 </div>

 {/* Comments Expandable Area */}
 {showComments && (
 <div className="mt-4 pt-4 border-t border-gray-50 flex flex-col gap-3">
 {post.comments?.length > 0 ? (
 <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
 {post.comments.map(c => {
 const cName = c.author?.sobrenome ? `${c.author.nome} ${c.author.sobrenome}` : c.author?.nome || 'Usuário';
 return (
 <div key={c.id} className="flex gap-3">
 {c.author?.avatar_url ? (
 <img src={c.author.avatar_url} className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5 border border-gray-100" />
 ) : (
 <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
 {cName.charAt(0).toUpperCase()}
 </div>
 )}
 <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 flex-1">
 <div className="flex items-baseline justify-between mb-1">
 <span className="text-[13px] font-bold text-gray-800">{cName}</span>
 <span className="text-[10px] text-gray-400 font-medium">{new Date(c.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
 </div>
 <p className="text-[13.5px] text-gray-700 leading-snug">{c.conteudo}</p>
 </div>
 </div>
 )
 })}
 </div>
 ) : (
 <p className="text-center text-[13px] text-gray-400 italic py-2">Nenhum comentário ainda. Seja o primeiro!</p>
 )}
 {/* Add Comment */}
 <form onSubmit={handleComment} className="flex gap-2 items-center mt-2">
 <input type="text" value={newComment}
 onChange={(e) => setNewComment(e.target.value)}
 placeholder="Escreva um comentário..."
 maxLength={500}
 className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-2.5 text-[13.5px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-inner"
 />
 <button type="submit" disabled={!newComment.trim() || createCommentMutation.isPending}
 className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0 shadow-md"
 >
 {createCommentMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin className="text-[14px]" /> : <FontAwesomeIcon icon={faPaperPlane} className="text-[14px] ml-[-2px]" />}
 </button>
 </form>
 </div>
 )}
 </div>
 );
}

export default function ChatMuralWidget() {
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
 toast.error("Para a magia acontecer, digite um rascunho de texto primeiro!");
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
 loading: 'A Inteligência Artificial está reescrevendo o seu recado...',
 success: 'Pronto! Texto claro e profissional gerado com sucesso ✨',
 error: (err) => `Erro ao gerar: ${err.message}`
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

 return (
 <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
 <div className="p-5 md:p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
 <FontAwesomeIcon icon={faBullhorn} className="text-xl" />
 </div>
 <div>
 <h2 className="text-xl font-bold text-gray-800">Mural de Recados</h2>
 <p className="text-sm text-gray-500 mt-0.5">Comunicações e anúncios importantes da equipe</p>
 </div>
 </div>
 <button onClick={() => setIsCreating(!isCreating)}
 className="px-5 py-2.5 text-[14px] font-bold tracking-wide rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 w-full md:w-auto
 bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md"
 >
 {isCreating ? 'Cancelar Publicação' : 'Nova Publicação'}
 </button>
 </div>

 {isCreating && (
 <div className="p-5 md:p-6 bg-indigo-50/50 border-b border-gray-100 animate-in slide-in-from-top-4 duration-300">
 <form onSubmit={handleCreatePost} className="max-w-3xl mx-auto flex flex-col gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
 <h3 className="font-bold text-indigo-900 border-b border-gray-100 pb-3 mb-1">Criar Comunicado Oficial</h3>
 <input
 type="text"
 placeholder="Assunto da Publicação (ex: Reunião Geral, Nova Regra...)"
 value={assunto}
 maxLength={100}
 onChange={(e) => setAssunto(e.target.value)}
 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-semibold text-gray-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors shadow-inner"
 />
 <textarea
 placeholder="Escreva sua mensagem para toda a equipe. Detalhe bem seu recado..."
 value={conteudo}
 maxLength={2000}
 onChange={(e) => setConteudo(e.target.value)}
 className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-[14px] resize-none outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all min-h-[120px] shadow-inner"
 />
 <div className="flex justify-between items-center mt-2 gap-3">
 <button type="button"
 onClick={handleAiMagic}
 disabled={!conteudo.trim() || aiMutation.isPending}
 className="px-5 py-3.5 bg-blue-600 text-white rounded-xl font-bold shadow-sm text-[13px] hover:shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 group"
 >
 {aiMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faWandMagicSparkles} className="group-hover:rotate-12 transition-transform" />} Magia IA (Corrigir e Melhorar)
 </button>
 <button type="submit"
 disabled={!assunto.trim() || !conteudo.trim() || createPostMutation.isPending}
 className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg disabled:opacity-50 transition-all"
 >
 {createPostMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin className="mx-4" /> : 'Disparar Publicação no Mural'}
 </button>
 </div>
 </form>
 </div>
 )}

 <div className="p-5 md:p-6 bg-gray-50/50">
 {isLoading ? (
 <div className="flex flex-col items-center justify-center py-12">
 <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-indigo-300 mb-4" />
 <span className="text-gray-500 font-medium text-sm">Carregando as novidades da equipe...</span>
 </div>
 ) : (!posts || posts.length === 0) ? (
 <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-white">
 <div className="w-20 h-20 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-100 shadow-inner">
 <FontAwesomeIcon icon={faBullhorn} className="text-3xl" />
 </div>
 <h4 className="font-bold text-gray-800 text-lg mb-2">Mural Vazio e Silencioso</h4>
 <p className="text-[14.5px] text-gray-500 max-w-sm">Ninguém publicou nada ainda. Seja o primeiro a deixar um recado inspirador para o time!</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 gap-5 md:gap-6">
 {posts.map(post => <MuralPostCard key={post.id} post={post} user={user} onConvertPost={setPostToConvert} />)}
 </div>
 )}
 </div>

 {/* Atividade Modal Conversion */}
 {postToConvert && (
 <AtividadeModal isOpen={true} onClose={() => setPostToConvert(null)} initialData={{ nome: postToConvert.assunto, descricao: `[Origem: Mural de Recados]\n\n${postToConvert.conteudo}` }}
 />
 )}
 </div>
 );
}
