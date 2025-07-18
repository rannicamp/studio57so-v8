// app/api/cep/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const cep = searchParams.get('cep');

    if (!cep) {
        return NextResponse.json({ error: 'CEP é obrigatório.' }, { status: 400 });
    }

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        if (!response.ok) {
            // Tenta ler a resposta para mais detalhes do erro, se disponível
            const errorText = await response.text();
            console.error(`Erro na API ViaCEP: ${response.status} - ${errorText}`);
            throw new Error('Erro ao buscar CEP na API externa.');
        }
        const data = await response.json();
        if (data.erro) {
            return NextResponse.json({ error: 'CEP inválido ou não encontrado.' }, { status: 404 });
        }
        return NextResponse.json(data);
    } catch (error) {
        console.error('Erro no servidor ao buscar CEP:', error);
        return NextResponse.json({ error: error.message || 'Erro interno do servidor ao buscar CEP.' }, { status: 500 });
    }
}