import { NextResponse } from 'next/server';
import { getBelvoClient } from '../../../../utils/belvo-factory';

export async function POST() {
    try {
        console.log("Iniciando geração de token Belvo..."); // Log para debug

        // Usa nosso ajudante para conectar
        const { client } = await getBelvoClient();
        
        console.log("Cliente Belvo inicializado. Solicitando widgetToken...");

        // Pede um token para o widget
        const response = await client.widgetToken.create();

        console.log("Token gerado com sucesso!");
        return NextResponse.json(response);
    } catch (error) {
        console.error('ERRO FATAL ao gerar token Belvo:', error);
        
        // Retorna o erro detalhado para o front-end saber o que houve
        return NextResponse.json(
            { 
                error: error.message || 'Erro interno ao conectar com a Belvo',
                details: error.response?.data || 'Sem detalhes adicionais'
            },
            { status: 500 }
        );
    }
}