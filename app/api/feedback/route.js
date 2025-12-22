import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
    const supabase = await createClient();
    try {
        const { usuario_id, pagina, descricao } = await request.json();

        if (!usuario_id || !descricao) {
            return NextResponse.json({ error: 'Descrição e ID do usuário são obrigatórios.' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('feedback')
            .insert({
                usuario_id,
                pagina,
                descricao,
                status: 'Aberto'
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