import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
 const supabase = await createClient();
 try {
 const { usuario_id, organizacao_id, pagina, descricao, link_opcional, imagem_url } = await request.json();

 if (!usuario_id || !descricao || !organizacao_id) {
 return NextResponse.json({ error: 'Faltam dados obrigatórios (usuário, organização ou descrição).' }, { status: 400 });
 }

 const { data, error } = await supabase
 .from('feedback')
 .insert({
 usuario_id,
 organizacao_id,
 pagina,
 descricao,
 link_opcional: link_opcional || null,
 imagem_url: imagem_url || null,
 status: 'Novo'
 })
 .select();

 if (error) {
 throw error;
 }

 return NextResponse.json({ message: 'Feedback recebido com sucesso!', data: data[0] });

 } catch (error) {
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}