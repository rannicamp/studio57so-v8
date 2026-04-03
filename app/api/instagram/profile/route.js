// app/api/instagram/profile/route.js
// Busca dados ricos do perfil Instagram de um participante
// Usado pela sidebar lateral do InstagramInbox

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY,
 { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function GET(request) {
 const supabase = getSupabaseAdmin();
 const { searchParams } = new URL(request.url);
 const participantId = searchParams.get('participant_id');
 const organizacaoId = searchParams.get('organizacao_id');

 if (!participantId || !organizacaoId) {
 return NextResponse.json({ error: 'participant_id e organizacao_id são obrigatórios' }, { status: 400 });
 }

 try {
 // 1. Buscar token da integração ativa
 const { data: integ } = await supabase
 .from('integracoes_meta')
 .select('page_access_token, instagram_business_account_id')
 .eq('organizacao_id', organizacaoId)
 .eq('is_active', true)
 .maybeSingle();

 const token = integ?.page_access_token || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
 if (!token) {
 return NextResponse.json({ error: 'Token não configurado' }, { status: 404 });
 }

 // 2. Buscar dados do perfil via Instagram Graph API
 const profileRes = await fetch(
 `https://graph.instagram.com/v21.0/${participantId}?fields=name,username,profile_pic,biography,website,followers_count,media_count&access_token=${token}`
 );
 const profileData = await profileRes.json();

 if (profileData.error) {
 console.warn('[Instagram Profile API] Erro:', profileData.error.message);
 // Retorna apenas o que temos no banco mesmo sem a API
 }

 // 3. Buscar dados históricos do banco (mensagens trocadas, data de início)
 const { data: conv } = await supabase
 .from('instagram_conversations')
 .select('id, participant_name, participant_username, participant_profile_pic, created_at, last_message_at, unread_count')
 .eq('participant_id', participantId)
 .eq('organizacao_id', organizacaoId)
 .maybeSingle();

 // 4. Contar mensagens trocadas
 let totalMessages = 0;
 if (conv?.id) {
 const { count } = await supabase
 .from('instagram_messages')
 .select('*', { count: 'exact', head: true })
 .eq('conversation_id', conv.id);
 totalMessages = count || 0;
 }

 // 5. Montar resposta unificada (API + banco)
 const profile = {
 participant_id: participantId,
 name: profileData.name || conv?.participant_name || `Usuário ${String(participantId).slice(-6)}`,
 username: profileData.username || conv?.participant_username || null,
 profile_pic: profileData.profile_pic || conv?.participant_profile_pic || null,
 biography: profileData.biography || null,
 website: profileData.website || null,
 followers_count: profileData.followers_count ?? null,
 media_count: profileData.media_count ?? null,
 // Dados do CRM
 first_contact: conv?.created_at || null,
 last_message: conv?.last_message_at || null,
 total_messages: totalMessages,
 // Link direto para o perfil no Instagram
 instagram_url: profileData.username
 ? `https://www.instagram.com/${profileData.username}/`
 : null,
 };

 return NextResponse.json(profile);

 } catch (error) {
 console.error('[Instagram Profile API] Erro:', error.message);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
