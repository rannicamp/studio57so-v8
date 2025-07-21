import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para criar um cliente Supabase "admin" que pode ser usado no servidor
// de forma segura para buscar os dados.
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Esta é a função que será executada quando a URL for acessada via GET
export async function GET(request, { params }) {
    const supabase = getSupabaseAdmin();
    const { id } = params; // Pega o ID do empreendimento da URL (ex: /api/empreendimentos/1)

    try {
        // Busca no banco de dados o empreendimento com o ID correspondente
        const { data: empreendimento, error } = await supabase
            .from('empreendimentos')
            .select('*') // Pega todas as colunas
            .eq('id', id) // Onde o ID bate com o da URL
            .single(); // Esperamos apenas um resultado

        // Se o empreendimento não for encontrado, retorna um erro 404
        if (error || !empreendimento) {
            return NextResponse.json({ error: 'Empreendimento não encontrado.' }, { status: 404 });
        }

        // Se encontrou, retorna os dados do empreendimento em formato JSON
        return NextResponse.json(empreendimento);

    } catch (error) {
        // Em caso de um erro inesperado, retorna um erro 500
        console.error("Erro na API de Empreendimentos:", error.message);
        return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
    }
}