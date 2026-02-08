import { NextResponse } from 'next/server';
import { getBelvoClient } from '../../../../utils/belvo-factory';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const linkId = searchParams.get('link_id');

        if (!linkId) {
            return NextResponse.json({ error: 'Link ID é obrigatório' }, { status: 400 });
        }

        const { client } = await getBelvoClient();

        // Busca as contas vinculadas a este Login (Link)
        const accounts = await client.accounts.list({
            filters: { link: linkId }
        });

        return NextResponse.json(accounts);
    } catch (error) {
        console.error('Erro ao listar contas Belvo:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}