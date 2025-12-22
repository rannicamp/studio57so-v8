import { NextResponse } from 'next/server';
import { getBelvoClient } from '../../../../utils/belvo-factory';

export async function POST(request) {
    try {
        const body = await request.json();
        const { linkId, accountId, dateFrom, dateTo } = body;

        if (!linkId || !accountId || !dateFrom || !dateTo) {
            return NextResponse.json({ error: 'Dados incompletos (linkId, accountId, datas)' }, { status: 400 });
        }

        const { client } = await getBelvoClient();

        // 1. Busca as transações na Belvo
        // save: true (salva na base da Belvo para consultas futuras)
        const transactions = await client.transactions.list({
            filters: {
                link: linkId,
                account: accountId,
                'value_date__gte': dateFrom,
                'value_date__lte': dateTo
            },
            save: true 
        });

        // 2. Formata para o padrão do Studio 57 (igual ao OFX)
        // O ConciliacaoManager espera: { id, data, valor, descricao }
        const formattedTransactions = transactions.map(t => ({
            id: t.id, // ID único da Belvo
            data: t.value_date, // YYYY-MM-DD
            valor: t.type === 'OUTFLOW' ? -Math.abs(t.amount) : Math.abs(t.amount), // Negativo se saiu, Positivo se entrou
            descricao: t.description || t.merchant?.name || 'Sem descrição'
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