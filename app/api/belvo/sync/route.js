import { NextResponse } from 'next/server';
import { belvoRequest } from '../../../../utils/belvo-http';

export async function POST(request) {
    try {
        const { link_id } = await request.json();

        if (!link_id) return NextResponse.json({ error: 'Link ID obrigatório' }, { status: 400 });

        // 1. Buscar Contas (Accounts)
        // Nota: Open Finance Brasil exige o link_id
        const contas = await belvoRequest(`/api/accounts/?link=${link_id}`);

        // 2. Buscar Transações (Últimos 90 dias)
        // Calculando datas dinamicamente
        const today = new Date().toISOString().split('T')[0];
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const dateFrom = ninetyDaysAgo.toISOString().split('T')[0];

        // O endpoint de transações aceita filtros de data
        const transacoes = await belvoRequest(
            `/api/transactions/?link=${link_id}&date_from=${dateFrom}&date_to=${today}&page_size=100`
        );

        // 3. Buscar Saldos (Balances)
        const saldos = await belvoRequest(`/api/br/balances/?link=${link_id}`);

        // Aqui você salvaria tudo no Supabase...
        // await salvarNoBanco(contas, transacoes, saldos);

        return NextResponse.json({
            success: true,
            data: {
                accounts_count: contas.results?.length || 0,
                transactions_count: transacoes.results?.length || 0,
                balances_count: saldos.results?.length || 0
            }
        });

    } catch (error) {
        // Se pedir MFA, o front deve saber
        if (error.message.includes('MFA_REQUIRED')) {
            return NextResponse.json({ error: 'MFA_REQUIRED', link: link_id }, { status: 428 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}