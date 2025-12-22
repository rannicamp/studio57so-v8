import { NextResponse } from 'next/server';
import { getBelvoClient } from '../../../../utils/belvo-factory';

export async function POST() {
    try {
        // Usa nosso ajudante para conectar
        const { client } = await getBelvoClient();

        // Pede um token para o widget
        const response = await client.widgetToken.create();

        return NextResponse.json(response);
    } catch (error) {
        console.error('Erro ao gerar token Belvo:', error);
        return NextResponse.json(
            { error: error.message || 'Erro ao conectar com a Belvo' },
            { status: 500 }
        );
    }
}