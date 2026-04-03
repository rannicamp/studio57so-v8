import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

// Busca os posts com seus comentários e likes
export function useMuralPosts() {
 const { organizacao_id } = useAuth();
 const supabase = createClient();
 const queryClient = useQueryClient();

 const query = useQuery({
 queryKey: ['mural_posts', organizacao_id],
 queryFn: async () => {
 if (!organizacao_id) return [];

 const { data, error } = await supabase
 .from('sys_chat_mural_posts')
 .select(`
 *,
 author:usuarios!sys_chat_mural_posts_author_id_fkey(id, nome, sobrenome, avatar_url, funcoes(nome_funcao)),
 comments:sys_chat_mural_comments(
 id, conteudo, created_at, author:usuarios!sys_chat_mural_comments_author_id_fkey(id, nome, sobrenome, avatar_url)
 ),
 likes:sys_chat_mural_likes(id, user_id)
 `)
 .eq('organizacao_id', organizacao_id)
 .order('created_at', { ascending: false });

 if (error) {
 console.error("Erro ao buscar mural:", error);
 throw error;
 }

 // Ordena os comentarios por data crescente
 data.forEach(post => {
 if (post.comments) {
 post.comments.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
 }
 });

 return data;
 },
 enabled: !!organizacao_id,
 staleTime: Infinity,
 });

 // Subscriptions Realtime
 useEffect(() => {
 if (!organizacao_id) return;
 const channel = supabase.channel(`mural-${organizacao_id}`)
 .on('postgres_changes', { event: '*', schema: 'public', table: 'sys_chat_mural_posts', filter: `organizacao_id=eq.${organizacao_id}` }, () => {
 queryClient.invalidateQueries({ queryKey: ['mural_posts', organizacao_id] });
 })
 // Como comentarios e likes verificam o post_id, a gente assina a tabela toda e o query cuida da org
 .on('postgres_changes', { event: '*', schema: 'public', table: 'sys_chat_mural_comments' }, () => {
 queryClient.invalidateQueries({ queryKey: ['mural_posts', organizacao_id] });
 })
 .on('postgres_changes', { event: '*', schema: 'public', table: 'sys_chat_mural_likes' }, () => {
 queryClient.invalidateQueries({ queryKey: ['mural_posts', organizacao_id] });
 })
 .subscribe();

 return () => supabase.removeChannel(channel);
 }, [organizacao_id, queryClient, supabase]);

 return query;
}

export function useCreateMuralPost() {
 const supabase = createClient();
 const { user, organizacao_id } = useAuth();

 return useMutation({
 mutationFn: async ({ assunto, conteudo }) => {
 if (!user || !organizacao_id) throw new Error("Não autenticado");
 const { error } = await supabase.from('sys_chat_mural_posts').insert([{
 organizacao_id,
 author_id: user.id,
 assunto,
 conteudo
 }]);
 if (error) throw error;
 }
 });
}

export function useCreateMuralComment() {
 const supabase = createClient();
 const { user } = useAuth();

 return useMutation({
 mutationFn: async ({ postId, conteudo }) => {
 if (!user) throw new Error("Não autenticado");
 const { error } = await supabase.from('sys_chat_mural_comments').insert([{
 post_id: postId,
 author_id: user.id,
 conteudo
 }]);
 if (error) throw error;
 }
 });
}

export function useToggleMuralLike() {
 const supabase = createClient();
 const { user } = useAuth();

 return useMutation({
 mutationFn: async ({ postId, isLiked }) => {
 if (!user) throw new Error("Não autenticado");
 if (isLiked) {
 const { error } = await supabase
 .from('sys_chat_mural_likes')
 .delete()
 .eq('post_id', postId)
 .eq('user_id', user.id);
 if (error) throw error;
 } else {
 const { error } = await supabase
 .from('sys_chat_mural_likes')
 .insert([{ post_id: postId, user_id: user.id }]);
 if (error && error.code !== '23505') throw error;
 }
 }
 });
}

export function useMuralAISuggestion() {
 return useMutation({
 mutationFn: async ({ text, assuntoAtual }) => {
 const res = await fetch('/api/ai/mural-suggestion', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ text, assuntoAtual }),
 });
 if (!res.ok) {
 const error = await res.json();
 throw new Error(error.error || "Falha na resposta da Inteligência Artificial");
 }
 return res.json(); // { assunto, conteudo }
 }
 });
}

export function useDeleteMuralPost() {
 const supabase = createClient();
 const queryClient = useQueryClient();
 return useMutation({
 mutationFn: async (postId) => {
 const { error } = await supabase.from('sys_chat_mural_posts').delete().eq('id', postId);
 if (error) throw error;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['mural_posts'] });
 }
 });
}
