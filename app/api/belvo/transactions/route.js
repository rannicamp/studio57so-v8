import { NextResponse } from 'next/server';
import { getBelvoClient } from '../../../../utils/belvo-factory';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const linkId = searchParams.get('link_id');
        const accountId = searchParams.get('account_id');
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');

        if (!linkId || !accountId) {
            return NextResponse.json({ error: 'Link ID e Account ID são obrigatórios' }, { status: 400 });
        }

        const { client } = await getBelvoClient();

        // Busca transações na Belvo
        // Nota: A Belvo pede datas no formato YYYY-MM-DD
        const transactions = await client.transactions.list({
            filters: {
                link: linkId,
                account: accountId,
                'value_date__gte': dateFrom,
                'value_date__lte': dateTo
            }
        });

        // Formata para o padrão do nosso sistema (igual ao OFX)
        const formattedTransactions = transactions.map(t => ({
            id: t.id, // ID único da Belvo
            data: t.value_date, // Data da transação
            valor: t.amount, // Valor (negativo para saída, positivo para entrada na Belvo, mas as vezes vem invertido dependendo do tipo, vamos ajustar no front se precisar)
            descricao: t.description || t.merchant?.name || 'Transação Belvo',
            status: t.status
        }));

        return NextResponse.json(formattedTransactions);
    } catch (error) {
        console.error('Erro ao buscar transações Belvo:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}