import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request) {
 try {
 // Recebemos o ID do anúncio e o novo status (ACTIVE ou PAUSED)
 const { adId, status } = await request.json();

 if (!adId || !status) {
 return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
 }

 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

 const { data: userData } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
 const { data: integracao } = await supabase
 .from('integracoes_meta')
 .select('access_token')
 .eq('organizacao_id', userData.organizacao_id)
 .single();

 if (!integracao?.access_token) {
 return NextResponse.json({ error: 'Token do Meta não encontrado' }, { status: 400 });
 }

 // =========================================================================
 // A MÁGICA INFALÍVEL: Comunicação Direta com o Graph API do Meta
 // O PORQUÊ: Bypassamos o SDK para ter certeza absoluta de que o Meta obedeceu.
 // =========================================================================
 const url = `https://graph.facebook.com/v24.0/${adId}`;
 // Empacotamos os dados como se fossem um formulário da web
 const formData = new URLSearchParams();
 formData.append('status', status);
 formData.append('access_token', integracao.access_token);

 const fbResponse = await fetch(url, {
 method: 'POST',
 body: formData,
 });

 const fbData = await fbResponse.json();

 // Se o Meta reclamar de alguma coisa, nós pegamos o erro na hora!
 if (fbData.error) {
 console.error('Erro detalhado direto do Meta:', fbData.error);
 throw new Error(fbData.error.message);
 }

 return NextResponse.json({ success: true, status, meta_response: fbData });

 } catch (error) {
 console.error('Erro ao atualizar status do anúncio no Meta:', error);
 return NextResponse.json({ error: 'Falha ao atualizar anúncio' }, { status: 500 });
 }
}